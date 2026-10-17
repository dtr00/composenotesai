import { cn } from "cn";
import { useRef } from "react";
import { AI_ACTIVITY_LABELS, useAiActivity } from "../../../entities/note/model/ai-activity";
import { useNoteTitle } from "../../../entities/note/model/note-list-store";
import type { NoteEntry } from "../../../shared/api/notes";
import { DitherGlyph } from "../../../shared/ui/dither-glyph";
import { notePath } from "../../../shared/config/routes";
import { Link } from "../../../shared/ui/link";
import { useNotePreview } from "../hooks/use-note-preview";
import { useRenameFocus } from "../hooks/use-rename-focus";
import { useTreeContext } from "../hooks/use-tree-context";
import { indentStyle, RENAME_INPUT, ROW_ICONS } from "../lib/tree-row";
import { noteActionGroups } from "../model/note-actions";
import { endRenaming, startRenaming, useRenaming } from "../model/tree-store";
import { NoteIcon, NotePreview } from "./note-preview";
import { NoteTitleInput } from "./note-title-input";
import { RenameRow, TreeRowItem } from "./tree-row-item";

interface NoteListItemProps {
  note: NoteEntry;
  index: number;
  depth: number;
  open: boolean;
}

export function NoteListItem({ note, index, depth, open }: NoteListItemProps) {
  const dragging = useTreeContext().drag !== null;
  const title = useNoteTitle(note.id) ?? note.title;
  const renaming = useRenaming(note) !== null;
  const { input, requestRename, finalFocus } = useRenameFocus();
  const rowRef = useRef<HTMLLIElement>(null);
  const { previewable, previewing, hoverProps } = useNotePreview(note.id);
  const activity = useAiActivity(note.id);
  const rename = () => {
    requestRename();
    startRenaming(note);
  };

  return (
    <>
      <TreeRowItem
        ref={rowRef}
        {...hoverProps}
        entry={note}
        index={index}
        depth={depth}
        label={title}
        finalFocus={finalFocus}
        actions={(entries) => noteActionGroups(note.id, entries, rename, { includeOpenInTab: true })}
      >
        {renaming ? (
          <RenameRow depth={depth}>
            <NoteIcon previewable={false} format={note.format} />
            <NoteTitleInput ref={input} noteId={note.id} onBlur={endRenaming} className={RENAME_INPUT} />
          </RenameRow>
        ) : (
          <Link
            href={`#${notePath(note.id)}`}
            variant="ghost"
            className={cn(
              "w-full justify-start aria-[current=page]:pointer-events-none aria-[current=page]:bg-foreground/8 aria-[current=page]:text-sidebar-accent-foreground group-data-popup-open/row:ring-1 group-data-popup-open/row:ring-sidebar-ring group-data-popup-open/row:ring-inset",
              ROW_ICONS,
            )}
            style={indentStyle(depth)}
            aria-current={open ? "page" : undefined}
            data-sidebar-item
            draggable={false}
          >
            {activity ? (
              <DitherGlyph label={AI_ACTIVITY_LABELS[activity]} className="text-foreground!" />
            ) : (
              <NoteIcon previewable={previewable} format={note.format} />
            )}
            <span className="truncate">{title}</span>
          </Link>
        )}
      </TreeRowItem>
      <NotePreview id={note.id} open={previewing && !renaming && !dragging} anchor={rowRef} />
    </>
  );
}
