import {
  getEntries,
  loadNoteList,
  moveEntriesInList,
  renameEntry,
  setAllFoldersCollapsedInList,
  updateFolderInList,
} from "../../../entities/note/model/note-list-store";
import {
  createFolder,
  moveEntries,
  setAllFoldersCollapsed,
  setFolderCollapsed,
  toRef,
  type EntryRef,
  type Folder,
  type MediaSummary,
} from "../../../shared/api/notes";
import { containsEntry, folderIndex, isSameEntry, visibleRows } from "../../../entities/note/model/note-tree";
import { openSidebar } from "../../../features/sidebar/model/sidebar-store";
import { entryPath, matchEntry } from "../../../shared/config/routes";
import { currentPath, navigate, subscribeToPath } from "../../../shared/lib/hash-router";
import { onPointerDownOutside } from "../../../shared/lib/outside-pointer-down";
import { createStore, updateStore, useSelector, useStore } from "../../../shared/lib/store";
import { reportAction } from "../../../shared/lib/error-toast";

export interface Renaming {
  entry: EntryRef;
  autoFocus: boolean;
}

interface TreeState {
  renaming: Renaming | null;
  revealFolderId: number | null;
  anchor: EntryRef | null;
  selection: EntryRef[];
}

const store = createStore<TreeState>({ renaming: null, revealFolderId: null, anchor: null, selection: [] });

export function useTree(): TreeState {
  return useStore(store);
}

export const useRenaming = (entry: EntryRef) =>
  useSelector(store, (state) => (state.renaming && isSameEntry(state.renaming.entry, entry) ? state.renaming : null));

export const createAndRenameFolder = (parentId: number | null = null) =>
  reportAction(
    createFolder(parentId).then(async (folder) => {
      await loadNoteList();
      openSidebar();
      updateStore(store, { renaming: { entry: { kind: "folder", id: folder.id }, autoFocus: true } });
    }),
  );

export const startRenaming = (entry: EntryRef) =>
  updateStore(store, { renaming: { entry: toRef(entry), autoFocus: false } });

export const endRenaming = () => updateStore(store, { renaming: null });

async function commitName(ref: EntryRef, name: string, input: string) {
  endRenaming();
  const renamed = input.trim();
  if (renamed === "" || renamed === name) return name;
  return (await reportAction(renameEntry(ref, renamed))) ?? name;
}

export const commitFolderName = ({ id, name }: Folder, input: string) =>
  commitName({ kind: "folder", id }, name, input);

export const commitMediaName = ({ id, name }: MediaSummary, input: string) =>
  commitName({ kind: "media", id }, name, input);

export function expandFolder(folder: Folder) {
  if (folder.collapsed) toggleFolder(folder);
}

export function toggleFolder({ id, collapsed }: Folder) {
  updateFolderInList(id, { collapsed: !collapsed });
  void reportAction(setFolderCollapsed(id, !collapsed), () => updateFolderInList(id, { collapsed }));
}

export function clearSelection() {
  if (store.get().selection.length > 0) updateStore(store, { selection: [] });
}

const KEEPS_SELECTION = '[data-row-index], [role="menu"], [role="dialog"], [role="alertdialog"]';

export function startTreeSelection() {
  const anchorOpenEntry = () => {
    const open = matchEntry(currentPath());
    if (open) updateStore(store, { anchor: open });
  };
  anchorOpenEntry();
  subscribeToPath(anchorOpenEntry);
  onPointerDownOutside(KEEPS_SELECTION, clearSelection);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || store.get().selection.length === 0) return;
    clearSelection();
  });
}

export function selectRow(entry: EntryRef, extend: boolean) {
  const rows = visibleRows(getEntries()).map((row) => row.entry);
  const { anchor } = store.get();
  const from = anchor ? rows.findIndex((row) => isSameEntry(row, anchor)) : -1;
  const to = rows.findIndex((row) => isSameEntry(row, entry));
  if (!extend || from === -1 || from === to) {
    updateStore(store, { anchor: toRef(entry), selection: [] });
    return;
  }
  const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  updateStore(store, { selection: range.map(toRef) });
}

export function toggleRow(entry: EntryRef) {
  const { anchor, selection } = store.get();
  const rows = visibleRows(getEntries()).map((row) => row.entry);
  const seed = selection.length > 0 ? selection : anchor && containsEntry(rows, anchor) ? [toRef(anchor)] : [];
  const toggled = containsEntry(seed, entry) ? seed.filter((ref) => !isSameEntry(ref, entry)) : [...seed, toRef(entry)];
  if (toggled.length < 2) updateStore(store, { anchor: toggled[0] ?? toRef(entry), selection: [] });
  else updateStore(store, { anchor: toRef(entry), selection: toggled });
}

export function moveEntriesTo(moved: EntryRef[], parentId: number | null, index: number) {
  clearSelection();
  moveEntriesInList(moved, parentId, index);
  void reportAction(moveEntries(moved, parentId, index), loadNoteList);
}

export function setAllFolders(collapsed: boolean) {
  setAllFoldersCollapsedInList(collapsed);
  void reportAction(setAllFoldersCollapsed(collapsed), loadNoteList);
}

export function revealFolder(id: number) {
  openSidebar();
  for (const folder of folderIndex(getEntries()).trail(id).slice(0, -1)) expandFolder(folder);
  updateStore(store, { revealFolderId: id });
}

export function openFolderPage(id: number) {
  navigate(entryPath({ kind: "folder", id }));
  revealFolder(id);
}

export const endReveal = () => updateStore(store, { revealFolderId: null });
