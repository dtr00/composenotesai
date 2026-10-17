import { cn } from "cn";
import { Files } from "lucide-react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import {
  containsEntry,
  entryName,
  findEntry,
  isSameEntry,
  outermost,
  visibleRows,
} from "../../../entities/note/model/note-tree";
import type { Entry, EntryRef } from "../../../shared/api/notes";
import { buttonVariants } from "../../../shared/ui/button";
import { TreeContext } from "../hooks/use-tree-context";
import { useTreeDrag } from "../hooks/use-tree-drag";
import { indentStyle, ROW_ICONS } from "../lib/tree-row";
import { enterTree, leaveTree, useTreeTooltipsHidden } from "../model/shift-preview";
import { moveEntriesTo, useTree } from "../model/tree-store";
import { FolderIcons, FolderListItem } from "./folder-list-item";
import { MediaListItem } from "./media-list-item";
import { entryType } from "../../../entities/note/lib/entry-type";
import { EntryIcon } from "../../../entities/note/ui/entry-icon";
import { NoteListItem } from "./note-list-item";

function DragLabel({ moved }: { moved: Entry[] }) {
  const [first] = moved;
  if (moved.length > 1) {
    return (
      <>
        <Files />
        <span className="truncate">{moved.length} items</span>
      </>
    );
  }
  return (
    <>
      {first.kind === "folder" ? <FolderIcons folder={first} /> : <EntryIcon type={entryType(first)} />}
      <span className="truncate">{entryName(first)}</span>
    </>
  );
}

export function NoteTree({ current }: { current: EntryRef | null }) {
  const entries = useEntries();
  const { revealFolderId, selection } = useTree();
  const rows = visibleRows(entries);
  const tooltipsHidden = useTreeTooltipsHidden();
  const { drag, target, listRef, ghostRef, startDrag } = useTreeDrag(entries, rows, moveEntriesTo);
  const draggedWith = (entry: Entry): Entry[] =>
    containsEntry(selection, entry)
      ? outermost(entries, selection).flatMap((ref) => findEntry(entries, ref) ?? [])
      : [entry];

  return (
    <TreeContext
      value={{
        selection,
        drag,
        target,
        revealFolderId,
        hideTooltips: drag !== null || tooltipsHidden,
        startDrag: (event, entry) => startDrag(event, draggedWith(entry)),
      }}
    >
      <ul
        ref={listRef}
        className="-my-0.5 -mr-3 -ml-0.5 flex flex-1 flex-col gap-px overflow-y-scroll p-0.5 select-none"
        onPointerEnter={enterTree}
        onPointerLeave={leaveTree}
      >
        {rows.map(({ entry, depth }, index) => {
          const open = current !== null && isSameEntry(current, entry);
          const key = `${entry.kind}-${entry.id}`;
          switch (entry.kind) {
            case "note":
              return <NoteListItem key={key} note={entry} index={index} depth={depth} open={open} />;
            case "media":
              return <MediaListItem key={key} media={entry} index={index} depth={depth} open={open} />;
            case "folder":
              return <FolderListItem key={key} folder={entry} index={index} depth={depth} open={open} />;
          }
        })}
      </ul>
      {drag && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed top-0 left-0 z-50 rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ translate: `${drag.left}px ${drag.top}px`, width: drag.width }}
        >
          <div
            className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start", ROW_ICONS)}
            style={indentStyle(0)}
          >
            <DragLabel moved={drag.moved} />
          </div>
        </div>
      )}
    </TreeContext>
  );
}
