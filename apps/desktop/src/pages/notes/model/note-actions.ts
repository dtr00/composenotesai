import { folderIndex, outermost, parentOf, childrenOf, findEntry } from "../../../entities/note/model/note-tree";
import { isDrawing } from "../../../entities/note/lib/note-format";
import type { Entry, EntryRef, Folder, MediaSummary } from "../../../shared/api/notes";
import { requestFolderDelete, requestMediaDelete, requestNoteDelete, requestSelectionDelete } from "./delete-store";
import { exportExcalidrawNote } from "./excalidraw-export";
import { exportNoteAsPdf } from "./note-export";
import {
  createAndOpenExcalidraw,
  createAndOpenNote,
  makeCopy,
  openMediaInTab,
  openNoteInTab,
  openNoteInWindow,
} from "./notes-store";
import { createAndRenameFolder, expandFolder, moveEntriesTo } from "./tree-store";

export interface NoteCommand {
  label: string;
  run: () => void;
  variant?: "destructive";
  disabled?: boolean;
}

export interface NoteSubmenu {
  label: string;
  groups: NoteAction[][];
}

export type NoteAction = NoteCommand | NoteSubmenu;

function moveTo(entries: Entry[], moved: EntryRef[]): NoteAction[] {
  const parents = new Set(moved.map((ref) => parentOf(entries, ref)));
  const current = parents.size === 1 ? [...parents][0] : undefined;
  const { isWithin } = folderIndex(entries);
  const moveInto =
    (parentId: number | null): NoteCommand["run"] =>
    () =>
      moveEntriesTo(moved, parentId, childrenOf(entries, parentId, moved).length);
  const level = (parentId: number | null): NoteAction[] =>
    childrenOf(entries, parentId).flatMap((entry): NoteAction[] => {
      if (entry.kind !== "folder") return [];
      if (moved.some((ref) => isWithin(entry.id, ref))) return [];
      const here = { run: moveInto(entry.id), disabled: entry.id === current };
      const children = level(entry.id);
      if (children.length === 0) return [{ label: entry.name, ...here }];
      return [{ label: entry.name, groups: [[{ label: "Move here", ...here }], children] }];
    });
  const folders = level(null);
  if (folders.length === 0 && current === null) return [];
  const topLevel = { label: "Top level", run: moveInto(null), disabled: current === null };
  return [{ label: "Move to", groups: [[topLevel], folders] }];
}

export function noteActionGroups(
  id: number,
  entries: Entry[],
  rename: () => void,
  { includeOpenInTab }: { includeOpenInTab: boolean },
): NoteAction[][] {
  const openInTab: NoteAction[] = includeOpenInTab ? [{ label: "Open in new tab", run: () => openNoteInTab(id) }] : [];
  const drawing = isDrawing(findEntry(entries, { kind: "note", id })?.format);
  return [
    [...openInTab, { label: "Open in new window", run: () => void openNoteInWindow(id) }],
    [
      { label: "Rename", run: rename },
      ...moveTo(entries, [{ kind: "note", id }]),
      { label: "Make a copy", run: () => void makeCopy({ kind: "note", id }) },
    ],
    [
      drawing
        ? { label: "Export as Excalidraw", run: () => exportExcalidrawNote(id) }
        : { label: "Export as PDF", run: () => exportNoteAsPdf(id) },
    ],
    [{ label: "Delete note", run: () => requestNoteDelete(id), variant: "destructive" }],
  ];
}

export function mediaActionGroups(
  media: MediaSummary,
  entries: Entry[],
  rename: () => void,
  { includeOpenInTab }: { includeOpenInTab: boolean },
): NoteAction[][] {
  const ref: EntryRef = { kind: "media", id: media.id };
  const openInTab: NoteAction[][] = includeOpenInTab
    ? [[{ label: "Open in new tab", run: () => openMediaInTab(media.id) }]]
    : [];
  return [
    ...openInTab,
    [
      { label: "Rename", run: rename },
      ...moveTo(entries, [ref]),
      { label: "Make a copy", run: () => void makeCopy(ref) },
    ],
    [
      {
        label: `Delete ${media.mediaType}`,
        run: () => requestMediaDelete(media),
        variant: "destructive",
      },
    ],
  ];
}

interface FolderMenuFocus {
  rename: () => void;
  leaveFocus: () => void;
}

export function folderActionGroups(
  folder: Folder,
  entries: Entry[],
  { rename, leaveFocus }: FolderMenuFocus,
): NoteAction[][] {
  const createInside = (create: (parentId: number) => Promise<void>) => () => {
    leaveFocus();
    expandFolder(folder);
    void create(folder.id);
  };
  return [
    [
      { label: "New note", run: createInside((parentId) => createAndOpenNote({ parentId })) },
      { label: "New Excalidraw note", run: createInside(createAndOpenExcalidraw) },
      { label: "New folder", run: createInside(createAndRenameFolder) },
    ],
    [
      { label: "Rename", run: rename },
      ...moveTo(entries, [{ kind: "folder", id: folder.id }]),
      { label: "Make a copy", run: () => void makeCopy({ kind: "folder", id: folder.id }) },
    ],
    [{ label: "Delete folder", run: () => requestFolderDelete(folder), variant: "destructive" }],
  ];
}

export function selectionActionGroups(selection: EntryRef[], entries: Entry[]): NoteAction[][] {
  const remove: NoteAction = {
    label: `Delete ${selection.length} items`,
    run: () => requestSelectionDelete(selection),
    variant: "destructive",
  };
  return [moveTo(entries, outermost(entries, selection)), [remove]].filter((group) => group.length > 0);
}
