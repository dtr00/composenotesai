import { cn } from "cn";
import type { MediaEntry } from "../../../shared/api/notes";
import { entryPath } from "../../../shared/config/routes";
import { Link } from "../../../shared/ui/link";
import { useRenameFocus } from "../hooks/use-rename-focus";
import { indentStyle, RENAME_INPUT, ROW_ICONS } from "../lib/tree-row";
import { mediaActionGroups } from "../model/note-actions";
import { startRenaming, useRenaming } from "../model/tree-store";
import { EntryIcon } from "../../../entities/note/ui/entry-icon";
import { RenameRow, TreeRowItem } from "./tree-row-item";
import { MediaNameInput } from "./media-name-input";
import { fileExtension, withoutExtension } from "../../../shared/lib/file-extension";
import { Badge } from "../../../shared/ui/badge";

interface MediaListItemProps {
  media: MediaEntry;
  index: number;
  depth: number;
  open: boolean;
}

export function MediaListItem({ media, index, depth, open }: MediaListItemProps) {
  const renaming = useRenaming(media) !== null;
  const extension = fileExtension(media.name);
  const { input, requestRename, finalFocus } = useRenameFocus();
  const rename = () => {
    requestRename();
    startRenaming(media);
  };

  return (
    <TreeRowItem
      entry={media}
      index={index}
      depth={depth}
      label={media.name}
      finalFocus={finalFocus}
      actions={(entries) => mediaActionGroups(media, entries, rename, { includeOpenInTab: true })}
    >
      {renaming ? (
        <RenameRow depth={depth}>
          <EntryIcon type={media.mediaType} />
          <MediaNameInput ref={input} media={media} className={RENAME_INPUT} />
        </RenameRow>
      ) : (
        <Link
          href={`#${entryPath(media)}`}
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
          <EntryIcon type={media.mediaType} />
          <span className="truncate">{withoutExtension(media.name)}</span>
          {extension && (
            <Badge
              variant="outline"
              className="ml-auto h-4 rounded-sm px-1 text-[0.5625rem] text-muted-foreground uppercase"
            >
              {extension}
            </Badge>
          )}
        </Link>
      )}
    </TreeRowItem>
  );
}
