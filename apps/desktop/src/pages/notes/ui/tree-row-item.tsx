import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import { containsEntry } from "../../../entities/note/model/note-tree";
import type { Entry, EntryRef } from "../../../shared/api/notes";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../../../shared/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { useTreeContext } from "../hooks/use-tree-context";
import type { DropTarget } from "../hooks/use-tree-drag";
import { guidePx, indentPx, indentStyle, RENAME_ROW } from "../lib/tree-row";
import { selectionActionGroups, type NoteAction } from "../model/note-actions";
import { clearSelection, endReveal, selectRow, toggleRow, useRenaming } from "../model/tree-store";
import { CONTEXT_MENU_PARTS, NoteActionItems } from "./note-action-items";

type RowActions = (entries: Entry[]) => NoteAction[][];

function RowMenuItems({ selection, actions }: { selection: EntryRef[] | null; actions: RowActions }) {
  const entries = useEntries();
  const groups = selection ? selectionActionGroups(selection, entries) : actions(entries);
  return <NoteActionItems groups={groups} parts={CONTEXT_MENU_PARTS} />;
}

function DropLine({ target }: { target: DropTarget }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-0 h-0.5 rounded-full bg-sidebar-primary",
        target.edge === "top" ? "-top-px" : "-bottom-px",
      )}
      style={{ left: indentPx(target.depth) }}
    />
  );
}

function IndentGuides({ depth }: { depth: number }) {
  return Array.from({ length: depth }, (_, level) => (
    <span
      key={level}
      aria-hidden
      className="pointer-events-none absolute top-0 -bottom-px w-px bg-sidebar-border"
      style={{ left: guidePx(level) }}
    />
  ));
}

function RevealAnchor() {
  return (
    <span
      aria-hidden
      ref={(anchor) => {
        if (!anchor) return;
        anchor.scrollIntoView({ block: "nearest" });
        endReveal();
      }}
      className="pointer-events-none absolute inset-0"
    />
  );
}

export function RenameRow({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <div className={RENAME_ROW} style={indentStyle(depth)}>
      {children}
    </div>
  );
}

interface TreeRowItemProps extends ComponentProps<"li"> {
  entry: Entry;
  index: number;
  depth: number;
  label: string;
  finalFocus: ComponentProps<typeof ContextMenuContent>["finalFocus"];
  actions: RowActions;
}

export function TreeRowItem({ entry, index, depth, label, finalFocus, actions, children, ...li }: TreeRowItemProps) {
  const tree = useTreeContext();
  const renaming = useRenaming(entry) !== null;
  const selected = containsEntry(tree.selection, entry);
  const dropHere = tree.target?.rowIndex === index ? tree.target : null;
  const revealed = entry.kind === "folder" && tree.revealFolderId === entry.id;

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open && !selected) clearSelection();
      }}
    >
      <Tooltip disabled={tree.hideTooltips}>
        <TooltipTrigger
          render={
            <ContextMenuTrigger
              render={
                <li
                  {...li}
                  data-row-index={index}
                  className={cn(
                    "group/row relative rounded-md",
                    selected && "bg-primary/12 text-sidebar-accent-foreground",
                    tree.drag && containsEntry(tree.drag.moved, entry) && "opacity-50",
                    dropHere?.edge === "inside" && "bg-sidebar-accent ring-1 ring-sidebar-primary ring-inset",
                  )}
                  onPointerDown={renaming ? undefined : (event) => tree.startDrag(event, entry)}
                  onClickCapture={
                    renaming
                      ? undefined
                      : (event) => {
                          const toggle = event.ctrlKey || event.metaKey;
                          if (event.shiftKey || toggle) event.preventDefault();
                          if (event.shiftKey) selectRow(entry, true);
                          else if (toggle) toggleRow(entry);
                          else selectRow(entry, false);
                        }
                  }
                />
              }
            />
          }
        >
          {children}
          <IndentGuides depth={depth} />
          {revealed && <RevealAnchor />}
          {dropHere && dropHere.edge !== "inside" && <DropLine target={dropHere} />}
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
      <ContextMenuContent finalFocus={finalFocus}>
        <RowMenuItems selection={selected ? tree.selection : null} actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
