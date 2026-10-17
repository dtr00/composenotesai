import {
  clearTitleDraft,
  listNote,
  loadNoteList,
  removeEntriesFromList,
  renameEntry,
  savedNoteTitle,
  titleDraftOf,
  getEntries,
} from "../../../entities/note/model/note-list-store";
import { findNoteByTitle } from "../../../entities/note/model/note-tree";
import { refreshTrash } from "../../../entities/note/model/trash-store";
import { forgetPaths, openInNewTab, openTab } from "../../../features/tabs/model/tabs-store";
import {
  createNote,
  duplicateEntry,
  loadNote,
  saveNote,
  trashEntries,
  type EntryRef,
  type Note,
  type NoteFormat,
  type NoteSummary,
} from "../../../shared/api/notes";
import { onWindowCloseRequested, openWindow } from "../../../shared/api/windows";
import { entryPath, notePath } from "../../../shared/config/routes";
import { navigate } from "../../../shared/lib/hash-router";
import {
  dismissToast,
  errorMessage,
  reportAction,
  showError,
  showLastingWarning,
} from "../../../shared/lib/error-toast";
import { serializeSaves } from "../../../shared/lib/serialize-saves";
import { createStore, updateStore, useSelector, useStore } from "../../../shared/lib/store";

const SAVE_DELAY_MS = 500;
const SAVE_TOAST = "note-save";
const OPEN_TOAST = "note-open";
const CLOSE_TOAST = "unsaved-close";
const CLOSE_WARNING = "Some changes are not saved yet. Close again to discard them.";

export type OpenNote = Omit<Note, "title" | "parentId" | "body">;

interface NotesState {
  open: OpenNote | null;
  creating: boolean;
  closeArmed: boolean;
}

const store = createStore<NotesState>({
  open: null,
  creating: false,
  closeArmed: false,
});
const update = (changes: Partial<NotesState>) => updateStore(store, changes);
const bodies = createStore<ReadonlyMap<number, string | null>>(new Map());
const unsaved = new Set<number>();
const fetchingBodies = new Set<number>();
let saveTimer: number | undefined;
let requestedId: number | null = null;

function disarmClose() {
  update({ closeArmed: false });
  dismissToast(CLOSE_TOAST);
}

export function useNotes(): NotesState {
  return useStore(store);
}

const bodyOf = (id: number) => bodies.get().get(id);

const setBody = (id: number, body: string | null) => bodies.set(new Map(bodies.get()).set(id, body));

function rememberSaved(id: number, body: string) {
  if (!unsaved.has(id)) setBody(id, body);
}

async function flushDrafts() {
  let failure: string | null = null;
  for (const id of [...unsaved]) {
    const body = bodyOf(id);
    if (typeof body !== "string") continue;
    try {
      await saveNote(id, body);
      if (bodyOf(id) === body) unsaved.delete(id);
    } catch (e) {
      failure = errorMessage(e);
    }
  }
  if (failure === null) dismissToast(SAVE_TOAST);
  else showError(failure, SAVE_TOAST);
  if (store.get().closeArmed && unsaved.size === 0) disarmClose();
}

const flushQueue = serializeSaves(flushDrafts);

export function saveDrafts(): Promise<void> {
  window.clearTimeout(saveTimer);
  return flushQueue().catch((e: unknown) => showError(e, SAVE_TOAST));
}

export function editNote(id: number, body: string) {
  unsaved.add(id);
  setBody(id, body);
  if (store.get().closeArmed) disarmClose();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDrafts, SAVE_DELAY_MS);
}

export const latestBody = (id: number) => bodyOf(id) ?? "";

const bodyWatchers = new Map<number, Set<(body: string) => void>>();

export function watchNoteBody(id: number, watcher: (body: string) => void) {
  const watchers = bodyWatchers.get(id) ?? new Set();
  watchers.add(watcher);
  bodyWatchers.set(id, watchers);
  return () => {
    watchers.delete(watcher);
    if (watchers.size === 0) bodyWatchers.delete(id);
  };
}

export function showNoteBody(id: number, body: string) {
  bodyWatchers.get(id)?.forEach((watcher) => watcher(body));
}

export async function readNoteBody(id: number): Promise<string> {
  if (unsaved.has(id)) return latestBody(id);
  const { body } = await loadNote(id);
  rememberSaved(id, body);
  return body;
}

export function writeNoteBody(id: number, body: string) {
  editNote(id, body);
  showNoteBody(id, body);
}

function forgetBodies(ids: number[]) {
  const next = new Map(bodies.get());
  for (const id of ids) {
    next.delete(id);
    unsaved.delete(id);
  }
  bodies.set(next);
}

export function prefetchBody(id: number) {
  if (typeof bodyOf(id) === "string" || fetchingBodies.has(id)) return;
  fetchingBodies.add(id);
  loadNote(id)
    .then(
      (note) => note.body,
      () => null,
    )
    .then((body) => {
      if (typeof bodyOf(id) !== "string") setBody(id, body);
    })
    .finally(() => fetchingBodies.delete(id));
}

export const usePreviewBody = (id: number): string | null | undefined => useSelector(bodies, (all) => all.get(id));

export async function openNote(id: number | null) {
  requestedId = id;
  await saveDrafts();
  if (requestedId !== id || (store.get().open?.id ?? null) === id) return;
  if (id === null) {
    update({ open: null });
    return;
  }
  try {
    const { title, parentId, body, ...note } = await loadNote(id);
    if (requestedId !== id) return;
    listNote({ id, title, parentId, format: note.format });
    rememberSaved(id, body);
    dismissToast(OPEN_TOAST);
    update({ open: note });
  } catch (e) {
    if (requestedId !== id) return;
    update({ open: null });
    showError(e, OPEN_TOAST);
  }
}

interface NewNote {
  parentId?: number | null;
  title?: string | null;
  format?: NoteFormat;
  show?: (path: string) => void;
}

export async function createListedNote({
  parentId = null,
  title = null,
  format,
  show = navigate,
}: NewNote = {}): Promise<NoteSummary> {
  const note = await createNote(parentId, title, format);
  await loadNoteList();
  show(notePath(note.id));
  return note;
}

export async function createAndOpenNote(note: NewNote = {}) {
  update({ creating: true });
  await reportAction(createListedNote(note));
  update({ creating: false });
}

export const createAndOpenExcalidraw = (parentId: number | null = null) =>
  createAndOpenNote({ parentId, format: "excalidraw" });

export const createNoteInNewTab = () => createAndOpenNote({ show: openInNewTab });
export const createExcalidrawInNewTab = () => createAndOpenNote({ format: "excalidraw", show: openInNewTab });

export function openNoteByTitle(title: string) {
  const note = findNoteByTitle(getEntries(), title);
  if (note) navigate(notePath(note.id));
  else void createAndOpenNote({ title });
}

export async function makeCopy(entry: EntryRef) {
  await saveDrafts();
  await reportAction(
    duplicateEntry(entry).then(async (copy) => {
      await loadNoteList();
      if (copy.kind === "note") navigate(entryPath(copy));
    }),
  );
}

export const openNoteInTab = (id: number) => openTab(notePath(id));

export const openMediaInTab = (id: number) => openTab(entryPath({ kind: "media", id }));

export const openNoteInWindow = (id: number) => reportAction(openWindow(notePath(id)));

function forgetDeleted(deleted: EntryRef[]) {
  const notes = deleted.flatMap((entry) => (entry.kind === "note" ? [entry.id] : []));
  removeEntriesFromList(deleted);
  forgetPaths(deleted.map(entryPath));
  forgetBodies(notes);
}

export async function trashEntriesAndClose(entries: EntryRef[]): Promise<number[]> {
  await saveDrafts();
  const trashed = await reportAction(trashEntries(entries));
  if (!trashed) return [];
  forgetDeleted(trashed.removed);
  void refreshTrash();
  return trashed.trashIds;
}

export async function commitTitleDraft(id: number) {
  const draft = titleDraftOf(id);
  if (draft === undefined) return;
  if (draft.trim() !== savedNoteTitle(id)) await reportAction(renameEntry({ kind: "note", id }, draft));
  clearTitleDraft(id, draft);
}

export function guardUnsavedClose(saveSession: () => Promise<void>, { keepOpen }: { keepOpen: boolean }) {
  void onWindowCloseRequested(async (event) => {
    try {
      await saveSession();
    } catch (e) {
      event.preventDefault();
      showError(e, CLOSE_TOAST);
      return;
    }
    await saveDrafts();
    if (keepOpen) return event.preventDefault();
    if (unsaved.size === 0 || store.get().closeArmed) return;
    event.preventDefault();
    update({ closeArmed: true });
    showLastingWarning(CLOSE_WARNING, CLOSE_TOAST);
  });
}
