import { getEntries } from "../../../entities/note/model/note-list-store";
import { contentsOf, findEntry, notesIn } from "../../../entities/note/model/note-tree";
import { readChatAttachment, readChatAttachmentFile, type TextFile } from "../../../shared/api/chats";
import type { EntryRef } from "../../../shared/api/notes";
import { errorMessage, showError } from "../../../shared/lib/error-toast";
import { createStore, useStore } from "../../../shared/lib/store";
import { clipAttachment } from "../lib/wire";
import { chatHost, type HostNote } from "./chat-host";
import type { ChatAttachment, PendingAttachment } from "./conversation";

const MAX_FOLDER_NOTES = 30;

const pending = createStore<PendingAttachment[]>([]);

export const usePendingAttachments = () => useStore(pending);

function sameAttachment(a: PendingAttachment, b: PendingAttachment) {
  if (a.kind === "file" || b.kind === "file")
    return a.kind === "file" && b.kind === "file" && a.name === b.name && a.content === b.content;
  return a.kind === b.kind && a.id === b.id;
}

const mentionOf = (attachment: PendingAttachment) => (attachment.kind === "file" ? undefined : attachment.mention);

function clearMentionWhenReaddedWithout(current: PendingAttachment[], added: PendingAttachment[]) {
  return current.map((existing) => {
    const again = added.find((attachment) => sameAttachment(attachment, existing));
    return again && existing.kind !== "file" && !mentionOf(again) ? { ...existing, mention: undefined } : existing;
  });
}

function add(attachments: PendingAttachment[]) {
  const kept = clearMentionWhenReaddedWithout(pending.get(), attachments);
  const fresh = attachments.filter(
    (attachment, index) =>
      !kept.some((other) => sameAttachment(other, attachment)) &&
      attachments.findIndex((other) => sameAttachment(other, attachment)) === index,
  );
  pending.set([...kept, ...fresh]);
}

export function dropUnmentioned(text: string) {
  const current = pending.get();
  const kept = current.filter((attachment) => {
    const mention = mentionOf(attachment);
    return mention === undefined || text.includes(mention);
  });
  if (kept.length !== current.length) pending.set(kept);
}

export const removeAttachment = (index: number) => pending.set(pending.get().filter((_, at) => at !== index));

export const clearAttachments = () => pending.set([]);

export function restoreAttachments(attachments: ChatAttachment[]) {
  add(
    attachments.flatMap((attachment): PendingAttachment[] => {
      if (attachment.kind === "file") return [{ kind: "file", name: attachment.name, content: attachment.content }];
      return [{ kind: attachment.kind, id: attachment.id, name: attachment.name }];
    }),
  );
}

export const canAttachEntries = (refs: EntryRef[]) => refs.some((ref) => ref.kind === "note" || ref.kind === "folder");

export function attachEntries(refs: EntryRef[], mention?: string) {
  const entries = getEntries();
  add(
    refs.flatMap((ref): PendingAttachment[] => {
      if (ref.kind === "media") return [];
      const entry = findEntry(entries, ref);
      if (entry?.kind === "note") return [{ kind: "note", id: entry.id, name: entry.title, mention }];
      if (entry?.kind === "folder") return [{ kind: "folder", id: entry.id, name: entry.name, mention }];
      return [];
    }),
  );
}

async function attachRead<T>(sources: T[], read: (source: T) => Promise<TextFile>) {
  const attached = await Promise.all(
    sources.map(async (source): Promise<PendingAttachment | null> => {
      try {
        const file = await read(source);
        return { kind: "file", name: file.name, content: file.text };
      } catch (error) {
        showError(error);
        return null;
      }
    }),
  );
  add(attached.filter((attachment): attachment is PendingAttachment => attachment !== null));
}

export const attachFiles = (files: File[]) => attachRead(files, readChatAttachmentFile);

export const attachPaths = (paths: string[]) => attachRead(paths, readChatAttachment);

async function readNote(id: number, title: string, onError: (error: unknown) => void): Promise<HostNote | null> {
  try {
    return await chatHost().readNote(id);
  } catch (error) {
    onError(error);
    return { title, body: `(This note couldn't be read: ${errorMessage(error)})` };
  }
}

async function folderContent(id: number): Promise<string> {
  const notes = notesIn(contentsOf(getEntries(), [{ kind: "folder", id }])).slice(0, MAX_FOLDER_NOTES);
  if (notes.length === 0) return "(This folder has no notes.)";
  const failures: unknown[] = [];
  const onError = (error: unknown) => failures.push(error);
  const read = await Promise.all(
    notes.map(async (note) => ({ note, read: await readNote(note.id, note.title, onError) })),
  );
  if (failures.length > 0) showError(failures[0]);
  return read
    .map(({ note, read }) => {
      const content = read ? read.body.trim() || "(empty)" : "(This note no longer exists.)";
      return `## ${note.title} (note id ${note.id})\n\n${content}`;
    })
    .join("\n\n");
}

async function sent(attachment: PendingAttachment): Promise<ChatAttachment | null> {
  if (attachment.kind === "file") {
    return { kind: "file", name: attachment.name, content: clipAttachment(attachment.content) };
  }
  if (attachment.kind === "folder") {
    const content = clipAttachment(await folderContent(attachment.id));
    return { kind: "folder", name: attachment.name, id: attachment.id, content };
  }
  const note = await readNote(attachment.id, attachment.name, showError);
  return note && { kind: "note", name: note.title, id: attachment.id, content: clipAttachment(note.body) };
}

export async function takeAttachments(): Promise<ChatAttachment[]> {
  const taken = pending.get();
  clearAttachments();
  const read = await Promise.all(taken.map(sent));
  return read.filter((attachment): attachment is ChatAttachment => attachment !== null);
}
