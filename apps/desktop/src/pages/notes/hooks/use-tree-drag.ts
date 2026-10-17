import type { EditorView } from "@codemirror/view";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  containsEntry,
  folderIndex,
  isSameEntry,
  childrenOf,
  type TreeRow,
} from "../../../entities/note/model/note-tree";
import { toRef, type Entry, type MediaEntry } from "../../../shared/api/notes";
import { trackEntryDrop } from "../../../shared/lib/entry-drop";
import { trackPointerDrag } from "../../../shared/lib/pointer-drag";
import { clearMediaDrop, dropMedia, editorAt, showMediaDrop } from "../../../features/markdown-editor/lib/media-drop";

const FOLDER_EDGE = 0.25;

export interface DropTarget {
  parentId: number | null;
  index: number;
  rowIndex: number;
  edge: "top" | "bottom" | "inside";
  depth: number;
}

export interface Drag {
  moved: Entry[];
  left: number;
  top: number;
  width: number;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.parentId === b.parentId &&
    a.index === b.index &&
    a.rowIndex === b.rowIndex &&
    a.edge === b.edge);

function targetAtRow(entries: Entry[], rows: TreeRow[], moved: Entry[], rowIndex: number, fraction: number) {
  const { entry, depth } = rows[rowIndex];
  if (containsEntry(moved, entry)) return null;
  const indexIn = (parentId: number | null) => childrenOf(entries, parentId, moved).indexOf(entry);
  const overMiddle = fraction > FOLDER_EDGE && fraction < 1 - FOLDER_EDGE;
  const noFolders = moved.every((other) => other.kind !== "folder");
  if (entry.kind === "folder" && (noFolders || overMiddle)) {
    const index = childrenOf(entries, entry.id, moved).length;
    return { parentId: entry.id, index, rowIndex, edge: "inside", depth: depth + 1 } as const;
  }
  if (fraction < 0.5)
    return { parentId: entry.parentId, index: indexIn(entry.parentId), rowIndex, edge: "top", depth } as const;
  if ((rows[rowIndex + 1]?.depth ?? 0) > depth)
    return { parentId: entry.id, index: 0, rowIndex, edge: "bottom", depth: depth + 1 } as const;
  return { parentId: entry.parentId, index: indexIn(entry.parentId) + 1, rowIndex, edge: "bottom", depth } as const;
}

function findTarget(list: HTMLElement, entries: Entry[], rows: TreeRow[], moved: Entry[], x: number, y: number) {
  const bounds = list.getBoundingClientRect();
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
  const row = [...list.querySelectorAll<HTMLElement>("[data-row-index]")].find(
    (element) => y < element.getBoundingClientRect().bottom,
  );
  let target: DropTarget | null;
  if (row) {
    const { top, height } = row.getBoundingClientRect();
    target = targetAtRow(entries, rows, moved, Number(row.dataset.rowIndex), (y - top) / height);
  } else {
    const index = childrenOf(entries, null, moved).length;
    target = { parentId: null, index, rowIndex: rows.length - 1, edge: "bottom", depth: 0 };
  }
  const { isWithin } = folderIndex(entries);
  if (!target || moved.some((entry) => isWithin(target.parentId, entry))) return null;
  return keepsFoldersFirst(entries, moved, target) ? target : null;
}

const keepsFoldersFirst = (entries: Entry[], moved: Entry[], { parentId, index, edge }: DropTarget) =>
  edge === "inside" ||
  moved.some((entry) => entry.kind !== "folder") ||
  index <= childrenOf(entries, parentId, moved).filter((entry) => entry.kind === "folder").length;

const staysInPlace = (entries: Entry[], moved: Entry[], { parentId, index }: DropTarget) =>
  moved.length === 1 &&
  parentId === moved[0].parentId &&
  index === childrenOf(entries, parentId).findIndex((other) => isSameEntry(other, moved[0]));

export function useTreeDrag(
  entries: Entry[],
  rows: TreeRow[],
  onDrop: (moved: Entry[], parentId: number | null, index: number) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: ReactPointerEvent<HTMLElement>, moved: Entry[]) => {
    const list = listRef.current;
    if (!list) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    let dropTarget: DropTarget | null = null;
    const media = moved.filter((entry): entry is MediaEntry => entry.kind === "media");
    const insertable = media.length === moved.length;
    let editor: EditorView | null = null;
    const elsewhere = trackEntryDrop(moved.map(toRef));

    const trackEditor = (x: number, y: number) => {
      const next = insertable ? editorAt(x, y) : null;
      if (editor && editor !== next) clearMediaDrop(editor);
      editor = next;
      if (editor) showMediaDrop(editor, y);
    };

    trackPointerDrag(event, {
      onStart: ({ clientX, clientY }) =>
        setDrag({ moved, left: clientX - offset.x, top: clientY - offset.y, width: rect.width }),
      onMove: ({ clientX, clientY }) => {
        ghostRef.current?.style.setProperty("translate", `${clientX - offset.x}px ${clientY - offset.y}px`);
        trackEditor(clientX, clientY);
        elsewhere.hoverZoneAt(clientX, clientY);
        const next = findTarget(list, entries, rows, moved, clientX, clientY);
        if (sameTarget(next, dropTarget)) return;
        dropTarget = next;
        setTarget(next);
      },
      onEnd: (dropped) => {
        setDrag(null);
        setTarget(null);
        if (elsewhere.dropIntoZone(dropped)) return;
        if (editor) {
          if (dropped) dropMedia(editor, media);
          else clearMediaDrop(editor);
          return;
        }
        if (dropped && dropTarget && !staysInPlace(entries, moved, dropTarget)) {
          onDrop(moved, dropTarget.parentId, dropTarget.index);
        }
      },
    });
  };

  return { drag, target, listRef, ghostRef, startDrag };
}
