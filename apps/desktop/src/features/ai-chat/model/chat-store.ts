import { clearAiActivity } from "../../../entities/note/model/ai-activity";
import { getEntries } from "../../../entities/note/model/note-list-store";
import { notesIn } from "../../../entities/note/model/note-tree";
import { getSettings } from "../../../entities/settings/model/settings-store";
import { deleteChat, listChats, loadChat, saveChat, type ChatSummary } from "../../../shared/api/chats";
import { findSkill, listSkills, type SkillSummary } from "../../../shared/api/skills";
import { errorMessage, reportAction, reportSucceeded, showError } from "../../../shared/lib/error-toast";
import { currentPath } from "../../../shared/lib/hash-router";
import { createStore, updateStore, useSelector, useStore } from "../../../shared/lib/store";
import { systemPrompt, type LoadedSkill, type NoteTitle } from "../lib/agent-prompt";
import { noteChangesFrom } from "../lib/note-changes";
import { noteIdIn } from "../lib/note-route";
import { withSavedImages } from "../lib/wire";
import { readSavedMessages } from "../lib/saved-chat";
import { matchingSkills } from "../lib/skill-match";
import { CHAT_COMMANDS } from "../config/chat-commands";
import { commandIn } from "../lib/chat-command";
import { agentTools } from "./agent-tools";
import { dropUnmentioned, restoreAttachments, takeAttachments } from "./attachments";
import { trustOnlyPagesLinkedFrom } from "./web-tools";
import { chatHost } from "./chat-host";
import {
  messageId,
  type AssistantMessage,
  type AssistantPart,
  type ChatAttachment,
  type ConversationMessage,
  type UserMessage,
} from "./conversation";
import { harnessFor, type HarnessUpdate } from "./harness";
import { currentModelChoice, refreshModels, resetChatModel } from "./models-store";

const TITLE_CHARS = 60;
const SAVE_TOAST = "chat-save";

interface ChatState {
  id: number | null;
  messages: ConversationMessage[];
  running: boolean;
  history: ChatSummary[];
  title: string | null;
}

const store = createStore<ChatState>({ id: null, messages: [], running: false, history: [], title: null });
const draft = createStore("");
let controller: AbortController | null = null;

export const useChat = () => useStore(store);

export const useChatRunning = () => useSelector(store, (state) => state.running);

export const useChatTitle = (): string | null =>
  useSelector(store, ({ messages, title }) => (messages.length === 0 ? null : (title ?? titleOf(messages))));

export const useQuizSubmitted = (callId: string) =>
  useSelector(store, ({ messages }) =>
    messages.some((message) => message.role === "user" && message.quizCallId === callId),
  );

export const useDraft = () => useStore(draft);

export function setDraft(text: string) {
  draft.set(text);
  dropUnmentioned(text);
}

const isRunning = () => store.get().running;

function titleOf(messages: ConversationMessage[]) {
  const first = messages.find((message): message is UserMessage => message.role === "user");
  const line =
    first?.text
      .split("\n")
      .find((text) => text.trim())
      ?.trim() ?? "New chat";
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS - 1)}…` : line;
}

export async function refreshChatHistory() {
  const history = await reportAction(listChats());
  if (history) updateStore(store, { history });
}

async function persist() {
  const { id, messages } = store.get();
  if (messages.length === 0) return;
  try {
    const saved = await saveChat(id, store.get().title ?? titleOf(messages), withSavedImages(messages));
    if (store.get().id === id) updateStore(store, { id: saved });
    await refreshChatHistory();
  } catch (error) {
    showError(error, SAVE_TOAST);
  }
}

function updateAssistant(id: string, change: (message: AssistantMessage) => AssistantMessage) {
  const messages = store
    .get()
    .messages.map((message) => (message.role === "assistant" && message.id === id ? change(message) : message));
  updateStore(store, { messages });
}

function appendText(parts: AssistantPart[], kind: "text" | "reasoning", delta: string): AssistantPart[] {
  const last = parts[parts.length - 1];
  if (last?.kind === kind) return [...parts.slice(0, -1), { ...last, text: last.text + delta }];
  return [...parts, { kind, text: delta, startedAt: Date.now() }];
}

function applyUpdate(message: AssistantMessage, update: HarnessUpdate): AssistantMessage {
  switch (update.type) {
    case "status":
      return { ...message, status: update.message };
    case "text":
    case "reasoning":
      return { ...message, status: null, parts: appendText(message.parts, update.type, update.delta) };
    case "tool": {
      const known = message.parts.some((part) => part.kind === "tool" && part.id === update.part.id);
      const parts = known
        ? message.parts.map((part) =>
            part.kind === "tool" && part.id === update.part.id ? { ...update.part, startedAt: part.startedAt } : part,
          )
        : [...message.parts, { ...update.part, startedAt: Date.now() }];
      return { ...message, status: null, parts };
    }
    case "stats":
      return { ...message, stats: update.stats };
  }
}

function finish(message: AssistantMessage, stopped: boolean): AssistantMessage {
  const finishedAt = Date.now();
  if (!stopped) return { ...message, status: null, finishedAt };
  const parts = message.parts.map((part) =>
    part.kind === "tool" && part.status === "running" ? { ...part, status: "stopped" as const } : part,
  );
  return { ...message, parts, status: null, stopped: true, finishedAt };
}

async function loadMatching(prompt: string, skills: SkillSummary[]): Promise<LoadedSkill[]> {
  const loaded = await Promise.all(matchingSkills(prompt, skills).map((skill) => findSkill(skill.name)));
  return loaded.flatMap((skill) => (skill ? [{ name: skill.name, body: skill.body }] : []));
}

function openNotes(notes: NoteTitle[]) {
  const viewing = noteIdIn(currentPath());
  const byId = (id: number) => notes.find((note) => note.id === id);
  const others = chatHost()
    .tabNoteIds()
    .filter((id) => id !== viewing);
  return {
    openNote: viewing === null ? null : (byId(viewing) ?? null),
    tabNotes: [...new Set(others)].flatMap((id) => byId(id) ?? []),
  };
}

export interface QuizAnswers {
  callId: string;
  attachment: ChatAttachment;
}

export async function sendMessage(text: string, quiz?: QuizAnswers) {
  const prompt = text.trim();
  if (!prompt || isRunning()) return;
  const choice = currentModelChoice();
  if (!choice) {
    showError("Choose a model first. You can add one in Settings > AI.");
    return;
  }
  updateStore(store, { running: true });
  const attachments = quiz ? [quiz.attachment] : await takeAttachments();
  const user: UserMessage = {
    id: messageId(),
    role: "user",
    text: prompt,
    attachments,
    sentAt: Date.now(),
    quizCallId: quiz?.callId,
  };
  const assistant: AssistantMessage = {
    id: messageId(),
    role: "assistant",
    model: choice.model.name,
    skills: [],
    parts: [],
    status: "Thinking…",
    error: null,
    stats: null,
  };
  const earlier = store.get().messages;
  updateStore(store, { messages: [...earlier, user, assistant] });
  const run = new AbortController();
  controller = run;
  const current = () => controller === run;
  const updateReply = (change: (message: AssistantMessage) => AssistantMessage) => {
    if (current()) updateAssistant(assistant.id, change);
  };
  try {
    const skills = await listSkills();
    const loadedSkills = await loadMatching(prompt, skills);
    updateReply((message) => ({ ...message, skills: loadedSkills.map((skill) => skill.name) }));
    const { ai } = getSettings();
    const notes = notesIn(getEntries());
    const web = !ai.webSearch ? "off" : navigator.onLine ? "online" : "offline";
    trustOnlyPagesLinkedFrom([...earlier, user]);
    await harnessFor(choice.ref).run({
      model: choice.ref,
      system: systemPrompt({
        instructions: ai.instructions,
        skills,
        loadedSkills,
        command: commandIn(prompt, CHAT_COMMANDS),
        notes,
        ...openNotes(notes),
        allowEdits: ai.allowEdits,
        web,
        vision: choice.model.vision,
        now: new Date(),
      }),
      history: [...earlier, user],
      tools: agentTools({
        allowEdits: ai.allowEdits,
        hasSkills: skills.some((skill) => skill.enabled),
        web: web === "online",
        vision: choice.model.vision,
      }),
      seesImages: choice.model.vision,
      signal: run.signal,
      update: (update) => updateReply((message) => applyUpdate(message, update)),
    });
  } catch (error) {
    updateReply((message) => ({ ...message, error: errorMessage(error) }));
  } finally {
    if (current()) {
      updateAssistant(assistant.id, (message) => finish(message, run.signal.aborted));
      controller = null;
      updateStore(store, { running: false });
      void persist();
    }
  }
}

export async function revertTo(id: string) {
  const { messages } = store.get();
  const index = messages.findIndex((message) => message.id === id);
  const message = messages[index];
  if (isRunning() || message?.role !== "user") return;
  if (!(await reportSucceeded(chatHost().revertNotes(noteChangesFrom(messages, index))))) return;
  setDraft(message.text);
  restoreAttachments(message.attachments);
  if (index > 0) {
    updateStore(store, { messages: messages.slice(0, index) });
    await persist();
    return;
  }
  const saved = store.get().id;
  updateStore(store, { id: null, messages: [], title: null });
  if (saved !== null) await reportAction(deleteChat(saved));
  await refreshChatHistory();
}

export async function renameChat(input: string) {
  const title = input.split(/\s+/).join(" ").trim();
  const { messages } = store.get();
  if (!title || messages.length === 0 || title === (store.get().title ?? titleOf(messages))) return;
  updateStore(store, { title });
  if (!isRunning()) await persist();
}

export function stopRun() {
  controller?.abort();
  clearAiActivity();
}

function reset(changes: Partial<ChatState>) {
  stopRun();
  resetChatModel();
  controller = null;
  updateStore(store, { id: null, messages: [], running: false, title: null, ...changes });
}

export const newChat = () => reset({});

export async function openSavedChat(id: number) {
  const saved = await reportAction(loadChat(id));
  if (!saved) return;
  reset({ id: saved.id, title: saved.title, messages: readSavedMessages(saved.messages) });
}

export async function removeSavedChat(id: number) {
  if (!(await reportSucceeded(deleteChat(id)))) return;
  if (store.get().id === id) reset({});
  await refreshChatHistory();
}

export function chatShown() {
  if (!isRunning()) resetChatModel();
  void refreshModels();
  void refreshChatHistory();
}
