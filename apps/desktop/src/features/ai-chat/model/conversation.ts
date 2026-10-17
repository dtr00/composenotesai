import type { WireImage } from "../../../shared/api/ai";

export type ToolStatus = "running" | "done" | "failed" | "stopped";

interface Timed {
  startedAt?: number;
}

export interface TextPart extends Timed {
  kind: "text";
  text: string;
}

export interface ReasoningPart extends Timed {
  kind: "reasoning";
  text: string;
}

export interface NoteSnapshot {
  title: string;
  body: string;
}

export type NoteChange = { kind: "created"; noteId: number } | { kind: "edited"; noteId: number; before: NoteSnapshot };

export interface ToolImage extends WireImage {
  width: number;
  height: number;
}

export interface ToolPart extends Timed {
  kind: "tool";
  id: string;
  name: string;
  arguments: string;
  status: ToolStatus;
  label: string;
  result: string | null;
  noteId: number | null;
  change?: NoteChange;
  image?: ToolImage;
}

export type AssistantPart = TextPart | ReasoningPart | ToolPart;

export type PendingAttachment =
  | { kind: "note" | "folder"; id: number; name: string; mention?: string }
  | { kind: "file"; name: string; content: string };

export type ChatAttachment =
  | { kind: "note" | "folder"; id: number; name: string; content: string }
  | { kind: "file"; name: string; content: string };

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
  attachments: ChatAttachment[];
  sentAt: number;
}

export interface RunStats {
  tokensPerSecond: number | null;
  completionTokens: number | null;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  model: string;
  skills: string[];
  parts: AssistantPart[];
  status: string | null;
  error: string | null;
  stats: RunStats | null;
  stopped?: boolean;
  finishedAt?: number;
}

export type ConversationMessage = UserMessage | AssistantMessage;

export const messageId = () => crypto.randomUUID();
