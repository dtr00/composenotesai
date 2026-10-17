import { isRecord } from "../../../shared/lib/is-record";
import type { ConversationMessage } from "../model/conversation";

function isMessage(value: unknown): value is ConversationMessage {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  if (value.role === "user") return typeof value.text === "string" && Array.isArray(value.attachments);
  return value.role === "assistant" && Array.isArray(value.parts) && Array.isArray(value.skills);
}

export const readSavedMessages = (raw: unknown): ConversationMessage[] =>
  Array.isArray(raw) ? raw.filter(isMessage) : [];
