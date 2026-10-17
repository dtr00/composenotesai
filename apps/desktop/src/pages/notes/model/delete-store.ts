import { getEntries, savedNoteTitle } from "../../../entities/note/model/note-list-store";
import { contentsOf, outermost } from "../../../entities/note/model/note-tree";
import { getSettings, updateSettings } from "../../../entities/settings/model/settings-store";
import { mediaLinks, type EntryRef, type Folder, type MediaSummary } from "../../../shared/api/notes";
import { counted } from "../../../shared/lib/plural";
import { countEntries, describeCounts } from "../../../entities/note/lib/entry-counts";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";
import { reportAction } from "../../../shared/lib/error-toast";
import { saveDrafts } from "./notes-store";
import { moveToTrash } from "./trash-history";
import { clearSelection } from "./tree-store";

export interface DeleteTarget {
  entries: EntryRef[];
  heading: string;
  description: string;
  usage: string | null;
  canSkipConfirm: boolean;
}

interface DeleteRequest {
  target: DeleteTarget | null;
  open: boolean;
}

const store = createStore<DeleteRequest>({ target: null, open: false });

export const useDeleteRequest = (): DeleteRequest => useStore(store);

function contentsSentence(entries: EntryRef[]) {
  const inside = contentsOf(getEntries(), entries);
  if (inside.length === 0) return "";
  const listed = describeCounts(countEntries(inside));
  return entries.length === 1 ? ` It contains ${listed}.` : ` This includes ${listed} inside them.`;
}

async function linkSentence(entries: EntryRef[]) {
  const deleted = [...entries, ...contentsOf(getEntries(), entries)];
  const media = deleted.flatMap((entry) => (entry.kind === "media" ? [entry.id] : []));
  if (media.length === 0) return "";
  await saveDrafts();
  const links = (await mediaLinks(media)).filter(
    ({ note }) => !deleted.some((entry) => entry.kind === "note" && entry.id === note.id),
  );
  if (links.length === 0) return "";
  const linked = new Set(links.map(({ mediaId }) => mediaId)).size;
  const notes = new Set(links.map(({ note }) => note.id)).size;
  const subject = linked === 1 ? "This attachment is" : "These attachments are";
  return `${subject} linked in ${counted(notes, "note")}.`;
}

async function requestDelete(entries: EntryRef[], heading: string, subject: string, skippable = false) {
  const links = await linkSentence(entries);
  if (skippable && links === "" && !getSettings().confirmNoteDelete) return moveToTrash(entries);
  const description = `${subject} will be moved to the trash.${contentsSentence(entries)}`;
  const canSkipConfirm = skippable && links === "";
  store.set({ target: { entries, heading, description, usage: links || null, canSkipConfirm }, open: true });
}

function requestSingleDelete(entry: EntryRef, name: string, noun: string = entry.kind) {
  void reportAction(requestDelete([entry], `Move ${noun} to trash?`, `“${name}”`, true));
}

export const requestNoteDelete = (id: number) => requestSingleDelete({ kind: "note", id }, savedNoteTitle(id) ?? "");

export const requestMediaDelete = ({ id, name, mediaType }: MediaSummary) =>
  requestSingleDelete({ kind: "media", id }, name, mediaType);

export const requestFolderDelete = ({ id, name }: Folder) =>
  void reportAction(requestDelete([{ kind: "folder", id }], "Move folder to trash?", `“${name}” and everything in it`));

export function requestSelectionDelete(selection: EntryRef[]) {
  const count = selection.length;
  const subject = `The ${count} selected items and everything in them`;
  void reportAction(requestDelete(outermost(getEntries(), selection), `Move ${count} items to trash?`, subject));
}

export const closeDeleteRequest = () => updateStore(store, { open: false });

export function confirmDeleteRequest(dontAskAgain: boolean) {
  const { target } = store.get();
  if (!target) return;
  closeDeleteRequest();
  clearSelection();
  if (target.canSkipConfirm && dontAskAgain) updateSettings({ confirmNoteDelete: false });
  void moveToTrash(target.entries);
}
