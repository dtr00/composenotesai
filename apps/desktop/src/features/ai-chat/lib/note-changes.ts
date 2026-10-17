import type { ConversationMessage, NoteChange } from "../model/conversation";

export function noteChangesFrom(messages: ConversationMessage[], index: number): NoteChange[] {
  return messages
    .slice(index)
    .flatMap((message) => (message.role === "assistant" ? message.parts : []))
    .flatMap((part) => (part.kind === "tool" && part.status === "done" && part.change ? [part.change] : []));
}

export interface ChangeCounts {
  notes: number;
  created: number;
}

export function firstChangePerNote(changes: NoteChange[]): NoteChange[] {
  const first = new Map<number, NoteChange>();
  for (const change of changes) if (!first.has(change.noteId)) first.set(change.noteId, change);
  return [...first.values()];
}

export function countChanges(changes: NoteChange[]): ChangeCounts {
  const first = firstChangePerNote(changes);
  return { notes: first.length, created: first.filter((change) => change.kind === "created").length };
}
