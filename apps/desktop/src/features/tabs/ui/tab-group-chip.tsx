import { cn } from "cn";
import { Folder, FolderOpen } from "lucide-react";
import type { KeyboardEvent } from "react";
import { UNFOCUSABLE } from "../../../shared/lib/unfocusable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../../shared/ui/context-menu";
import { useAfterMenuClose } from "../../../shared/hooks/use-after-menu-close";
import { startGroupDrag } from "../lib/tab-drag";
import {
  addTabToGroup,
  closeGroup,
  removeTabsFromGroups,
  renameGroup,
  setGroupCollapsed,
  startRenamingGroup,
  type TabGroup,
} from "../model/tabs-store";
import { DRAG_STATES } from "./tab-slot";

const CHIP =
  "flex h-7 max-w-40 min-w-0 cursor-default items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground select-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-sidebar-primary";

interface TabGroupChipProps {
  group: TabGroup;
  tabIds: number[];
  renaming: boolean;
}

function GroupNameInput({ group }: { group: TabGroup }) {
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") event.currentTarget.value = group.name;
    if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
  };

  return (
    <div className={cn(CHIP, "bg-foreground/8 ring-1 ring-sidebar-ring ring-inset")}>
      <FolderOpen />
      <input
        aria-label="Group name"
        defaultValue={group.name}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => renameGroup(group.id, event.currentTarget.value)}
        onKeyDown={handleKey}
        spellCheck={false}
        className="w-24 min-w-0 bg-transparent outline-none select-text"
      />
    </div>
  );
}

export function TabGroupChip({ group, tabIds, renaming }: TabGroupChipProps) {
  const { afterClose, onOpenChangeComplete } = useAfterMenuClose();
  if (renaming) return <GroupNameInput group={group} />;

  return (
    <ContextMenu onOpenChangeComplete={onOpenChangeComplete}>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            aria-expanded={!group.collapsed}
            aria-label={`${group.name} group, ${tabIds.length} ${tabIds.length === 1 ? "tab" : "tabs"}`}
            {...UNFOCUSABLE}
            onClick={() => setGroupCollapsed(group.id, !group.collapsed)}
            onPointerDown={(event) => startGroupDrag(event, group.id)}
            className={cn(
              CHIP,
              "hover:bg-foreground/10 data-popup-open:ring-1 data-popup-open:ring-sidebar-ring data-popup-open:ring-inset",
              DRAG_STATES,
            )}
          />
        }
      >
        {group.collapsed ? <Folder /> : <FolderOpen />}
        <span className="truncate">{group.name}</span>
        {group.collapsed && <span className="text-muted-foreground tabular-nums">{tabIds.length}</span>}
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={false}>
        <ContextMenuItem onClick={() => addTabToGroup(group.id)}>New tab in group</ContextMenuItem>
        <ContextMenuItem onClick={() => afterClose(() => startRenamingGroup(group.id))}>Rename group</ContextMenuItem>
        <ContextMenuItem onClick={() => setGroupCollapsed(group.id, !group.collapsed)}>
          {group.collapsed ? "Expand group" : "Collapse group"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => removeTabsFromGroups(tabIds)}>Ungroup</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => closeGroup(group.id)}>Close group</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
