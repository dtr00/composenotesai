import { cn } from "cn";
import { Bot, Brain, ChevronRight, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { notePath } from "../../../shared/config/routes";
import { navigate } from "../../../shared/lib/hash-router";
import { counted } from "../../../shared/lib/plural";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../shared/ui/collapsible";
import { toolSummary } from "../lib/tool-summary";
import { FOLD_CHEVRON, FOLD_ICON, FOLD_TRIGGER } from "./fold-styles";
import { workedFor } from "../lib/work-time";
import { toolAction, toolNamed } from "../model/agent-tools";
import type { ReasoningPart, ToolPart } from "../model/conversation";

const MAX_RESULT_CHARS = 1500;

const DETAILS = "mt-1 ml-[7px] flex flex-col gap-1.5 border-l pl-3";

export type ProcessStep = ReasoningPart | ToolPart;

const shortResult = (result: string) =>
  result.length > MAX_RESULT_CHARS ? `${result.slice(0, MAX_RESULT_CHARS)}…` : result;

interface StepProps {
  icon: ReactNode;
  label: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

function Step({ icon, label, action, children }: StepProps) {
  return (
    <Collapsible className="text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <CollapsibleTrigger className={cn("group/step", FOLD_TRIGGER)}>
          {icon}
          {label}
          <ChevronRight
            className={cn(FOLD_CHEVRON, "group-hover/step:opacity-100 group-data-panel-open/step:rotate-90")}
          />
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className={cn(DETAILS, "text-[11px] text-muted-foreground")}>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningStep({ part, thinking }: { part: ReasoningPart; thinking: boolean }) {
  return (
    <Step
      icon={<Brain className={FOLD_ICON} />}
      label={<span className={cn("truncate", thinking && "animate-pulse")}>{thinking ? "Thinking…" : "Thought"}</span>}
    >
      <p className="text-xs/relaxed whitespace-pre-wrap select-text">{part.text.trim()}</p>
    </Step>
  );
}

function ToolStep({ part }: { part: ToolPart }) {
  const Icon = toolNamed(part.name)?.icon ?? Wrench;
  const { noteId } = part;
  const label = (
    <span
      className={cn(
        "truncate",
        part.status === "running" && "animate-pulse",
        part.status === "failed" && "text-destructive",
      )}
    >
      {part.label}
      {part.status === "stopped" && " (stopped)"}
      {part.status === "failed" && " (failed)"}
    </span>
  );
  const open = noteId !== null && part.status === "done" && (
    <button
      type="button"
      className="shrink-0 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      onClick={() => navigate(notePath(noteId))}
    >
      Open
    </button>
  );

  return (
    <Step icon={<Icon className={FOLD_ICON} />} label={label} action={open}>
      <pre className="overflow-x-auto font-mono whitespace-pre-wrap select-text">{part.arguments || "{}"}</pre>
      {part.image && (
        <img
          src={`data:${part.image.mimeType};base64,${part.image.data}`}
          alt="The drawing image the AI looked at"
          width={part.image.width}
          height={part.image.height}
          className="h-auto max-h-48 w-auto max-w-full self-start rounded-sm border object-contain"
        />
      )}
      {part.result !== null && (
        <pre className="max-h-48 overflow-auto font-mono whitespace-pre-wrap select-text">
          {shortResult(part.result)}
        </pre>
      )}
    </Step>
  );
}

function processLabel(steps: ProcessStep[], active: boolean, elapsed: number | null) {
  const tools = steps.filter((step): step is ToolPart => step.kind === "tool");
  const running = tools.find((tool) => tool.status === "running");
  if (running) return running.label;
  if (active) return steps[steps.length - 1].kind === "reasoning" ? "Thinking…" : "Working…";
  const done =
    elapsed !== null
      ? workedFor(elapsed)
      : tools.length > 0
        ? toolSummary(tools.map((tool) => ({ action: toolAction(tool.name), noteId: tool.noteId })))
        : "Thought process";
  const failed = tools.filter((tool) => tool.status === "failed").length;
  return failed > 0 ? `${done} (${counted(failed, "step")} failed)` : done;
}

interface AgentProcessProps {
  steps: ProcessStep[];
  active: boolean;
  elapsed: number | null;
}

export function AgentProcess({ steps, active, elapsed }: AgentProcessProps) {
  const last = steps.length - 1;

  return (
    <Collapsible className="text-xs">
      <CollapsibleTrigger className={cn("group/process", FOLD_TRIGGER)}>
        <Bot className={FOLD_ICON} />
        <span className={cn("truncate", active && "animate-pulse")}>{processLabel(steps, active, elapsed)}</span>
        <ChevronRight
          className={cn(FOLD_CHEVRON, "group-hover/process:opacity-100 group-data-panel-open/process:rotate-90")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className={DETAILS}>
        {steps.map((step, index) =>
          step.kind === "tool" ? (
            <ToolStep key={step.id} part={step} />
          ) : (
            <ReasoningStep key={index} part={step} thinking={active && index === last} />
          ),
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
