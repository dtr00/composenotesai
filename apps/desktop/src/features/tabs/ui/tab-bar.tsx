import { cn } from "cn";
import { Plus, X } from "lucide-react";
import { AnimatePresence, type Transition } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { AI_ACTIVITY_LABELS, useAiActivity } from "../../../entities/note/model/ai-activity";
import { useFolder, useMedia, useNoteTitle } from "../../../entities/note/model/note-list-store";
import { usePageLabel } from "../../../entities/web-page/model/page-titles";
import { BROWSER_PATH, isSettingsPath, matchEntry, matchWeb } from "../../../shared/config/routes";
import { useReducedTransition } from "../../../shared/hooks/use-reduced-transition";
import { UNFOCUSABLE } from "../../../shared/lib/unfocusable";
import { useHorizontalOverflow } from "../../../shared/hooks/use-horizontal-overflow";
import { scrollHorizontallyOnWheel } from "../../../shared/lib/wheel-scroll";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../../shared/ui/context-menu";
import { DitherGlyph } from "../../../shared/ui/dither-glyph";
import { TitleBarButton } from "../../../shared/ui/title-bar-button";
import { useAfterMenuClose } from "../../../shared/hooks/use-after-menu-close";
import { startTabDrag } from "../lib/tab-drag";
import {
  addTab,
  addTabsToGroup,
  barItems,
  clearTabSelection,
  closeOtherTabs,
  closeScopeTabs,
  closeTab,
  closeTabsById,
  closeTabsToLeft,
  closeTabsToRight,
  groupTabs,
  removeTabsFromGroups,
  selectTab,
  startRenamingGroup,
  selectTabRange,
  tabPath,
  toggleTabSelected,
  useTabs,
  type Tab,
} from "../model/tabs-store";
import { TabGroupChip } from "./tab-group-chip";
import { CHIP_SHOWN, DRAG_STATES, TAB_SHOWN, TabSlot } from "./tab-slot";

const TAB_TRANSITION: Transition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] };
const FADE_UNDER_SLOT = "mask-r-from-[calc(100%-1.75rem)] mask-r-to-[calc(100%-1.125rem)]";

const FADE_UNDER_CLOSE =
  "group-hover/tab:mask-r-from-[calc(100%-1.75rem)] group-hover/tab:mask-r-to-[calc(100%-1.125rem)] group-aria-selected/tab:mask-r-from-[calc(100%-1.75rem)] group-aria-selected/tab:mask-r-to-[calc(100%-1.125rem)]";

interface TabItemProps {
  tab: Tab;
  index: number;
  count: number;
  active: boolean;
  selected: boolean;
  targets: number[];
}

function clickTab(event: MouseEvent, id: number) {
  if (event.shiftKey) selectTabRange(id);
  else if (event.ctrlKey || event.metaKey) toggleTabSelected(id);
  else selectTab(id);
}

const hasModifier = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
  event.shiftKey || event.ctrlKey || event.metaKey;

function GroupMenuItems({ targets, afterClose }: { targets: number[]; afterClose: (action: () => void) => void }) {
  const { tabs, groups } = useTabs();
  const picked = tabs.filter((tab) => targets.includes(tab.id));
  const otherGroups = groups.filter((group) => !picked.every((tab) => tab.groupId === group.id));
  const several = targets.length > 1;

  return (
    <>
      <ContextMenuItem
        onClick={() => {
          const groupId = groupTabs(targets);
          afterClose(() => startRenamingGroup(groupId));
        }}
      >
        {several ? `Add ${targets.length} tabs to new group` : "Add to new group"}
      </ContextMenuItem>
      {otherGroups.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Add to group</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {otherGroups.map((group) => (
              <ContextMenuItem key={group.id} onClick={() => addTabsToGroup(targets, group.id)}>
                {group.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {picked.some((tab) => tab.groupId !== null) && (
        <ContextMenuItem onClick={() => removeTabsFromGroups(targets)}>Remove from group</ContextMenuItem>
      )}
    </>
  );
}

function TabItem({
  tab,
  index,
  count,
  active,
  selected,
  targets,
  title,
  indicator,
}: TabItemProps & { title: string; indicator?: ReactNode }) {
  const { afterClose, onOpenChangeComplete } = useAfterMenuClose();

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open && !selected) clearTabSelection();
      }}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <ContextMenuTrigger
        render={
          <div
            role="tab"
            aria-selected={active}
            data-selected={selected || undefined}
            {...UNFOCUSABLE}
            onClick={(event) => clickTab(event, tab.id)}
            onPointerDown={(event) => {
              if (!hasModifier(event)) startTabDrag(event, tab.id);
            }}
            className={cn(
              "group/tab relative flex h-7 min-w-0 flex-1 cursor-default items-center rounded-md pr-1 pl-2.5 text-xs text-muted-foreground select-none hover:bg-foreground/10 hover:text-foreground aria-selected:bg-foreground/8 aria-selected:text-foreground data-popup-open:ring-1 data-popup-open:ring-sidebar-ring data-popup-open:ring-inset data-selected:bg-primary/12! data-selected:text-sidebar-accent-foreground",
              DRAG_STATES,
            )}
          />
        }
      >
        <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", indicator ? FADE_UNDER_SLOT : FADE_UNDER_CLOSE)}>
          <span className="truncate">{title}</span>
          <span aria-hidden className="w-7 shrink-[100]" />
        </div>
        {indicator && (
          <span className="pointer-events-none absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center group-hover/tab:opacity-0">
            {indicator}
          </span>
        )}
        <button
          type="button"
          {...UNFOCUSABLE}
          aria-label={`Close ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            closeTab(tab.id);
          }}
          className={cn(
            "absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm opacity-0 group-hover/tab:opacity-100 hover:bg-foreground/10",
            !indicator && "group-aria-selected/tab:opacity-100",
          )}
        >
          <X className="size-3.5" />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent finalFocus={false}>
        <GroupMenuItems targets={targets} afterClose={afterClose} />
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => closeTabsById(targets)}>
          {targets.length > 1 ? `Close ${targets.length} tabs` : "Close tab"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => closeOtherTabs(tab.id)} disabled={count === 1}>
          Close others
        </ContextMenuItem>
        <ContextMenuItem onClick={() => closeTabsToRight(tab.id)} disabled={index === count - 1}>
          Close to the right
        </ContextMenuItem>
        <ContextMenuItem onClick={() => closeTabsToLeft(tab.id)} disabled={index === 0}>
          Close to the left
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => closeScopeTabs(tab.id)}>Close all</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function NoteTabItem({ noteId, ...props }: TabItemProps & { noteId: number }) {
  const title = useNoteTitle(noteId) ?? "Note";
  const activity = useAiActivity(noteId);
  const indicator = activity && <DitherGlyph label={AI_ACTIVITY_LABELS[activity]} />;
  return <TabItem {...props} title={title} indicator={indicator} />;
}

function FolderTabItem({ folderId, ...props }: TabItemProps & { folderId: number }) {
  const name = useFolder(folderId)?.name ?? "Folder";
  return <TabItem {...props} title={name} />;
}

function MediaTabItem({ mediaId, ...props }: TabItemProps & { mediaId: number }) {
  const name = useMedia(mediaId)?.name ?? "Media";
  return <TabItem {...props} title={name} />;
}

function WebTabItem({ url, ...props }: TabItemProps & { url: string }) {
  return <TabItem {...props} title={usePageLabel(props.tab.id, url)} />;
}

function TabEntry(props: TabItemProps) {
  const path = tabPath(props.tab);
  if (isSettingsPath(path)) return <TabItem {...props} title="Settings" />;
  if (path === BROWSER_PATH) return <TabItem {...props} title="Browser" />;
  const url = matchWeb(path);
  if (url !== null) return <WebTabItem {...props} url={url} />;
  const route = matchEntry(path);
  switch (route?.kind) {
    case "note":
      return <NoteTabItem {...props} noteId={route.id} />;
    case "folder":
      return <FolderTabItem {...props} folderId={route.id} />;
    case "media":
      return <MediaTabItem {...props} mediaId={route.id} />;
    default:
      return <TabItem {...props} title="New tab" />;
  }
}

function scopePosition(tabs: Tab[], tab: Tab) {
  const scope = tabs.filter((other) => other.groupId === tab.groupId);
  return { index: scope.indexOf(tab), count: scope.length };
}

export function TabBar() {
  const { tabs, groups, activeId, selection, renamingGroupId } = useTabs();
  const transition = useReducedTransition(TAB_TRANSITION);
  const [tabList, overflow] = useHorizontalOverflow<HTMLDivElement>();

  const slots = barItems({ tabs, groups }).map((item) =>
    item.kind === "chip" ? (
      <TabSlot
        key={`group-${item.group.id}`}
        data-group-chip={item.group.id}
        shown={CHIP_SHOWN}
        grouped={!item.group.collapsed}
        transition={transition}
      >
        <TabGroupChip group={item.group} tabIds={item.tabIds} renaming={renamingGroupId === item.group.id} />
      </TabSlot>
    ) : (
      <TabSlot
        key={item.tab.id}
        data-tab-id={item.tab.id}
        data-tab-group={item.group?.id}
        shown={TAB_SHOWN}
        grouped={item.group !== undefined}
        transition={transition}
      >
        <TabEntry
          tab={item.tab}
          {...scopePosition(tabs, item.tab)}
          active={item.tab.id === activeId}
          selected={selection.includes(item.tab.id)}
          targets={selection.includes(item.tab.id) ? selection : [item.tab.id]}
        />
      </TabSlot>
    ),
  );

  return (
    <div className="flex h-full min-w-0 items-center gap-0.5 px-1">
      <div
        ref={tabList}
        onWheel={scrollHorizontallyOnWheel}
        role="tablist"
        aria-label="Tabs"
        aria-multiselectable
        className={cn(
          "flex h-full min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          overflow.start && "mask-l-from-[calc(100%-2rem)]",
          overflow.end && "mask-r-from-[calc(100%-2rem)]",
        )}
      >
        <AnimatePresence initial={false}>{slots}</AnimatePresence>
      </div>
      <TitleBarButton aria-label="New tab" onClick={addTab}>
        <Plus className="size-[15px]" shapeRendering="crispEdges" />
      </TitleBarButton>
    </div>
  );
}
