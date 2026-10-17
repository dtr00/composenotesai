import {
  listEntries,
  renameFolder,
  renameMedia,
  renameNote,
  type Entry,
  type EntryRef,
  type Folder,
  type MediaSummary,
  type NoteSummary,
} from "../../../shared/api/notes";
import { dismissToast, errorMessage, showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useSelector } from "../../../shared/lib/store";
import { containsEntry, findEntry, foldersFirst, isEntry, isSameEntry, parentOf, childrenOf } from "./note-tree";

const LIST_TOAST = "note-list";

interface TitleDraft {
  id: number;
  title: string;
}

interface NoteListState {
  entries: Entry[];
  loading: boolean;
  error: string | null;
  titleDraft: TitleDraft | null;
}

const store = createStore<NoteListState>({ entries: [], loading: true, error: null, titleDraft: null });

export const useEntries = (): Entry[] => useSelector(store, (state) => state.entries);

export const getEntries = (): Entry[] => store.get().entries;

export const subscribeToNoteList = (listener: () => void) => store.subscribe(listener);

export const useFolder = (id: number): Folder | undefined =>
  useSelector(store, (state) => findEntry(state.entries, { kind: "folder", id }));

export const useMedia = (id: number | null): MediaSummary | undefined =>
  useSelector(store, (state) => (id === null ? undefined : findEntry(state.entries, { kind: "media", id })));

export const useMediaMissing = (id: number | null): boolean =>
  useSelector(
    store,
    (state) =>
      id !== null && !state.loading && state.error === null && !findEntry(state.entries, { kind: "media", id }),
  );

export const useNoteFormat = (id: number | null) =>
  useSelector(store, (state) => (id === null ? undefined : findEntry(state.entries, { kind: "note", id })?.format));

export const useNoteParentId = (id: number): number | null =>
  useSelector(store, (state) => parentOf(state.entries, { kind: "note", id }));

export function useNoteListStatus(): { loading: boolean; error: string | null } {
  const loading = useSelector(store, (state) => state.loading);
  const error = useSelector(store, (state) => state.error);
  return { loading, error };
}

export const loadNoteList = () =>
  listEntries().then(
    (entries) => {
      updateStore(store, { entries, loading: false, error: null });
      dismissToast(LIST_TOAST);
    },
    (e) => {
      updateStore(store, { loading: false, error: errorMessage(e) });
      showError(e, LIST_TOAST);
    },
  );

export function listNote(note: NoteSummary) {
  const { entries } = store.get();
  if (!findEntry(entries, { kind: "note", id: note.id }))
    updateStore(store, { entries: [...entries, { kind: "note", ...note }] });
}

export const removeEntriesFromList = (removed: EntryRef[]) =>
  updateStore(store, { entries: store.get().entries.filter((entry) => !containsEntry(removed, entry)) });

const mapEntries = (change: (entry: Entry) => Entry) =>
  updateStore(store, { entries: store.get().entries.map(change) });

const RENAME: Record<Entry["kind"], (id: number, name: string) => Promise<string | null>> = {
  note: renameNote,
  folder: renameFolder,
  media: renameMedia,
};

const named = (entry: Entry, name: string): Entry =>
  entry.kind === "note" ? { ...entry, title: name } : { ...entry, name };

export async function renameEntry(ref: EntryRef, name: string): Promise<string | null> {
  const stored = await RENAME[ref.kind](ref.id, name);
  if (stored !== null) mapEntries((entry) => (isSameEntry(entry, ref) ? named(entry, stored) : entry));
  return stored;
}

export const updateFolderInList = (id: number, changes: Partial<Folder>) =>
  mapEntries((entry) => (isEntry(entry, { kind: "folder", id }) ? { ...entry, ...changes } : entry));

export const setAllFoldersCollapsedInList = (collapsed: boolean) =>
  mapEntries((entry) => (entry.kind === "folder" ? { ...entry, collapsed } : entry));

export function moveEntriesInList(moved: EntryRef[], parentId: number | null, index: number) {
  const { entries } = store.get();
  const picked = moved.flatMap((ref) => findEntry(entries, ref) ?? []);
  const rest = entries.filter((candidate) => !containsEntry(moved, candidate));
  const anchor = childrenOf(rest, parentId)[index];
  const at = anchor ? rest.indexOf(anchor) : rest.length;
  const placed = picked.map((entry) => ({ ...entry, parentId }));
  updateStore(store, { entries: foldersFirst([...rest.slice(0, at), ...placed, ...rest.slice(at)]) });
}

const savedTitleIn = (state: NoteListState, id: number) => findEntry(state.entries, { kind: "note", id })?.title;

const draftIn = (state: NoteListState, id: number) =>
  state.titleDraft?.id === id ? state.titleDraft.title : undefined;

const liveTitleIn = (state: NoteListState, id: number) => draftIn(state, id)?.trim() || savedTitleIn(state, id);

export const savedNoteTitle = (id: number) => savedTitleIn(store.get(), id);

export const titleDraftOf = (id: number) => draftIn(store.get(), id);

export const useSavedNoteTitle = (id: number) => useSelector(store, (state) => savedTitleIn(state, id));

export const useNoteTitle = (id: number): string | undefined => useSelector(store, (state) => liveTitleIn(state, id));

export const useTitleDraft = (id: number) => useSelector(store, (state) => draftIn(state, id));

export const setTitleDraft = (id: number, title: string) => updateStore(store, { titleDraft: { id, title } });

export function clearTitleDraft(id: number, title: string) {
  if (titleDraftOf(id) === title) updateStore(store, { titleDraft: null });
}
