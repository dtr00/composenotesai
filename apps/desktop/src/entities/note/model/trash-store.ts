import {
  deleteFromTrash,
  emptyTrash,
  listTrash,
  restoreTrash,
  type EntryRef,
  type TrashItem,
} from "../../../shared/api/notes";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";
import { loadNoteList } from "./note-list-store";

const TRASH_TOAST = "trash";

interface TrashState {
  items: TrashItem[] | null;
}

const store = createStore<TrashState>({ items: null });

export const useTrash = () => useStore(store);

export const trashBytes = (items: TrashItem[] | null) => items?.reduce((sum, item) => sum + item.bytes, 0) ?? 0;

const showTrashError = (e: unknown) => showError(e, TRASH_TOAST);

export const reportTrashError = (work: Promise<unknown>): Promise<void> => work.then(() => undefined, showTrashError);

export function refreshTrash(): Promise<void> {
  return listTrash().then((items) => updateStore(store, { items }), showTrashError);
}

export async function restoreFromTrash(ids: number[]): Promise<EntryRef[]> {
  const restored = await restoreTrash(ids);
  await Promise.all([loadNoteList(), refreshTrash()]);
  return restored;
}

export const deleteForever = (ids: number[]) => deleteFromTrash(ids).then(refreshTrash);

export const clearTrash = () => emptyTrash().then(refreshTrash);
