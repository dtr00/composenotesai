import { cn } from "cn";
import { ChevronRight, Folder as FolderIcon, FolderOpen } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { Folder, FolderEntry } from "../../../shared/api/notes";
import { buttonVariants } from "../../../shared/ui/button";
import { useRenameFocus } from "../hooks/use-rename-focus";
import { indentStyle, RENAME_INPUT, ROW_ICONS } from "../lib/tree-row";
import { folderActionGroups } from "../model/note-actions";
import { commitFolderName, startRenaming, toggleFolder, useRenaming } from "../model/tree-store";
import { RenameRow, TreeRowItem } from "./tree-row-item";

export function FolderIcons({ folder }: { folder: Folder }) {
  return (
    <>
      <ChevronRight className={cn("transition-transform", !folder.collapsed && "rotate-90")} />
      {folder.collapsed ? <FolderIcon /> : <FolderOpen />}
    </>
  );
}

interface FolderListItemProps {
  folder: FolderEntry;
  index: number;
  depth: number;
  open: boolean;
}

export function FolderListItem({ folder, index, depth, open }: FolderListItemProps) {
  const renaming = useRenaming(folder);
  const { input, requestRename, leaveFocus, finalFocus } = useRenameFocus();
  const rename = () => {
    requestRename();
    startRenaming(folder);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") e.currentTarget.value = folder.name;
    if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <TreeRowItem
      entry={folder}
      index={index}
      depth={depth}
      label={folder.name}
      finalFocus={finalFocus}
      actions={(entries) => folderActionGroups(folder, entries, { rename, leaveFocus })}
    >
      {renaming ? (
        <RenameRow depth={depth}>
          <FolderIcons folder={folder} />
          <input
            ref={input}
            className={RENAME_INPUT}
            aria-label="Folder name"
            defaultValue={folder.name}
            autoFocus={renaming.autoFocus}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => void commitFolderName(folder, e.currentTarget.value)}
            onKeyDown={handleKey}
            spellCheck={false}
          />
        </RenameRow>
      ) : (
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-start transition-none aria-[current=page]:bg-foreground/8! aria-[current=page]:text-sidebar-accent-foreground! aria-expanded:bg-transparent aria-expanded:hover:bg-foreground/10 group-data-popup-open/row:ring-1 group-data-popup-open/row:ring-sidebar-ring group-data-popup-open/row:ring-inset",
            ROW_ICONS,
          )}
          style={indentStyle(depth)}
          aria-expanded={!folder.collapsed}
          aria-current={open ? "page" : undefined}
          data-sidebar-item
          onClick={(e) => {
            if (!e.defaultPrevented) toggleFolder(folder);
          }}
        >
          <FolderIcons folder={folder} />
          <span className="truncate">{folder.name}</span>
        </button>
      )}
    </TreeRowItem>
  );
}
