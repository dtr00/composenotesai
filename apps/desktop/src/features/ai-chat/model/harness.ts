import { cancelChat, streamChat, type ChatEvent, type WireMessage } from "../../../shared/api/ai";
import type { ModelRef } from "../../../shared/api/settings";
import { errorMessage } from "../../../shared/lib/error-toast";
import { isCompleteObject, jsonArguments, parsePartialObject } from "../lib/partial-json";
import { toolImages, toWire, withRecentImages } from "../lib/wire";
import { toolLabel, type AgentTool } from "./agent-tools";
import type { ConversationMessage, RunStats, ToolPart } from "./conversation";

const MAX_STEPS = 12;
const CUT_OFF_RESULT =
  "Error: this call was cut off before its arguments were complete, so nothing was changed. Try again. For long content, write part of it with write_note, then add the rest with append_to_note.";
const STEP_LIMIT_NOTE = "\n\nI stopped here because this took too many steps. Ask me to continue if you need more.";

export type HarnessUpdate =
  | { type: "status"; message: string | null }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool"; part: ToolPart }
  | { type: "stats"; stats: RunStats };

export interface HarnessRun {
  model: ModelRef;
  system: string;
  history: ConversationMessage[];
  tools: AgentTool[];
  seesImages: boolean;
  signal: AbortSignal;
  update: (update: HarnessUpdate) => void;
}

export interface AgentHarness {
  run: (run: HarnessRun) => Promise<void>;
}

interface PendingCall {
  part: ToolPart;
  tool: AgentTool | undefined;
}

const findTool = (tools: AgentTool[], name: string) => tools.find((tool) => tool.name === name);

function toolPart(id: string, name: string, args: string, tool: AgentTool | undefined): ToolPart {
  const parsed = parsePartialObject(args);
  return {
    kind: "tool",
    id,
    name,
    arguments: args,
    status: "running",
    label: tool ? toolLabel(tool, parsed, "running") : name,
    result: null,
    noteId: tool?.noteId?.(parsed) ?? null,
  };
}

async function streamTurn(
  run: HarnessRun,
  messages: WireMessage[],
  step: number,
): Promise<{ text: string; calls: PendingCall[] }> {
  const runId = crypto.randomUUID();
  const calls = new Map<number, PendingCall>();
  let text = "";
  const onEvent = (event: ChatEvent) => {
    switch (event.type) {
      case "status":
        return run.update({ type: "status", message: event.message });
      case "text":
        text += event.delta;
        return run.update({ type: "text", delta: event.delta });
      case "reasoning":
        return run.update({ type: "reasoning", delta: event.delta });
      case "toolCall": {
        const known = calls.get(event.index);
        const id = known?.part.id ?? event.id ?? `call_${step}_${event.index}`;
        const name = (known?.part.name ?? "") + (event.name ?? "");
        const args = (known?.part.arguments ?? "") + event.arguments;
        const tool = findTool(run.tools, name);
        const call = { part: toolPart(id, name, args, tool), tool };
        calls.set(event.index, call);
        if (!name) return;
        run.update({ type: "tool", part: call.part });
        return tool?.preview?.(id, parsePartialObject(args));
      }
      case "done":
        return run.update({
          type: "stats",
          stats: { tokensPerSecond: event.tokensPerSecond, completionTokens: event.completionTokens },
        });
    }
  };
  const cancel = () => void cancelChat(runId);
  run.signal.addEventListener("abort", cancel, { once: true });
  try {
    const specs = run.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const request = {
      provider: run.model.provider,
      model: run.model.model,
      messages: withRecentImages(messages, run.seesImages),
      tools: specs,
    };
    await streamChat(runId, request, onEvent);
  } finally {
    run.signal.removeEventListener("abort", cancel);
  }
  return { text, calls: [...calls.values()].filter((call) => call.part.name) };
}

function unlessStopped<T>(signal: AbortSignal, work: Promise<T>): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const stop = () => resolve(null);
    signal.addEventListener("abort", stop, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", stop);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", stop);
        reject(error);
      },
    );
  });
}

async function execute(run: HarnessRun, { part, tool }: PendingCall): Promise<ToolPart> {
  if (!tool) return { ...part, status: "failed", result: `There's no tool called "${part.name}".` };
  if (!isCompleteObject(part.arguments)) {
    tool.discard?.(part.id);
    return { ...part, status: "failed", result: CUT_OFF_RESULT };
  }
  const args = parsePartialObject(part.arguments);
  try {
    const running = tool.run(args, part.id);
    const outcome = tool.edits ? await running : await unlessStopped(run.signal, running);
    if (!outcome) return { ...part, status: "stopped" };
    return {
      ...part,
      status: "done",
      label: toolLabel(tool, args, "done"),
      result: outcome.result,
      noteId: outcome.noteId ?? part.noteId,
      change: outcome.change,
      image: outcome.image,
    };
  } catch (error) {
    if (run.signal.aborted) tool.discard?.(part.id);
    return { ...part, status: "failed", result: `Error: ${errorMessage(error)}` };
  }
}

async function runLocalAgent(run: HarnessRun) {
  const messages: WireMessage[] = [{ role: "system", content: run.system }, ...toWire(run.history)];
  for (let step = 0; step < MAX_STEPS; step++) {
    const { text, calls } = await streamTurn(run, messages, step);
    if (run.signal.aborted) {
      for (const call of calls) call.tool?.discard?.(call.part.id);
      return;
    }
    if (calls.length === 0) return;
    messages.push({
      role: "assistant",
      content: text,
      toolCalls: calls.map(({ part }) => ({ id: part.id, name: part.name, arguments: jsonArguments(part.arguments) })),
    });
    const finished: ToolPart[] = [];
    for (const call of calls) {
      const part = await execute(run, call);
      finished.push(part);
      run.update({ type: "tool", part });
      messages.push({ role: "tool", toolCallId: part.id, toolName: part.name, content: part.result ?? "" });
      if (run.signal.aborted) return;
    }
    messages.push(...toolImages(finished));
    run.update({ type: "status", message: "Thinking…" });
  }
  run.update({ type: "text", delta: STEP_LIMIT_NOTE });
}

const localHarness: AgentHarness = { run: runLocalAgent };

export const harnessFor: (model: ModelRef) => AgentHarness = () => localHarness;
