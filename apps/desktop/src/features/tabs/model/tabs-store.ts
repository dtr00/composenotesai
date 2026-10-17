import {
  saveTabSession,
  type SavedTab,
  type SavedTabGroup,
  type SavedTabSession,
} from "../../../shared/api/tab-session";
import type { EntryRef } from "../../../shared/api/notes";
import {
  BROWSER_PATH,
  isSettingsPath,
  matchEntry,
  matchWeb,
  NEW_TAB_PATH,
  webPath,
} from "../../../shared/config/routes";
import { dismissToast, showError } from "../../../shared/lib/error-toast";
import { currentPath, navigate, subscribeToPath } from "../../../shared/lib/hash-router";
import { onPointerDownOutside } from "../../../shared/lib/outside-pointer-down";
import { saveWhenChanged } from "../../../shared/lib/serialize-saves";
import { createStore, useSelector, useStore } from "../../../shared/lib/store";
import { restoreSession, sessionSnapshot } from "./tab-session";

const NEW_GROUP_NAME = "Group";

export type Tab = SavedTab;
export type TabGroup = SavedTabGroup;

export type BarItem =
  { kind: "chip"; group: TabGroup; tabIds: number[] } | { kind: "tab"; tab: Tab; group: TabGroup | undefined };

interface TabsState {
  tabs: Tab[];
  groups: TabGroup[];
  activeId: number;
  selection: number[];
  renamingGroupId: number | null;
}

export const tabPath = (tab: Tab) => tab.entries[tab.index];

const replacesNewTab = (tab: Tab, path: string) => tabPath(tab) === NEW_TAB_PATH && !isSettingsPath(path);

const landsOnSettings = (tab: Tab, forgotten: ReadonlySet<string>, landing: string) =>
  forgotten.has(tabPath(tab)) && isSettingsPath(landing);

const TAB_SESSION_TOAST = "tab-session-save";

let nextId = 1;
let nextGroupId = 1;
const createTab = (path: string, groupId: number | null = null): Tab => ({
  id: nextId++,
  entries: [path],
  index: 0,
  groupId,
});
const blankTab = (id: number): Tab => ({ id, entries: [NEW_TAB_PATH], index: 0, groupId: null });

const store = createStore<TabsState>({
  tabs: [blankTab(0)],
  groups: [],
  activeId: 0,
  selection: [],
  renamingGroupId: null,
});
let persisting = false;

export function useTabs(): TabsState {
  return useStore(store);
}

function activeTab({ tabs, activeId }: TabsState): Tab {
  const tab = tabs.find((candidate) => candidate.id === activeId);
  if (!tab) throw new Error(`Active tab ${activeId} is missing.`);
  return tab;
}

export const watchTabs = (listener: (tabs: Tab[]) => void) => store.subscribe(() => listener(store.get().tabs));

export const useActiveTab = (): Tab => useSelector(store, activeTab);

export const openTabPaths = (): string[] => store.get().tabs.map(tabPath);

export function tabEntry(id: number): EntryRef | null {
  const tab = store.get().tabs.find((candidate) => candidate.id === id);
  return tab ? matchEntry(tabPath(tab)) : null;
}

export function useHistoryState(): { canGoBack: boolean; canGoForward: boolean } {
  const { index, entries } = activeTab(useTabs());
  return { canGoBack: index > 0, canGoForward: index < entries.length - 1 };
}

const groupById = (groups: TabGroup[], id: number | null) => groups.find((group) => group.id === id);

const isHidden = (groups: TabGroup[], tab: Tab) => groupById(groups, tab.groupId)?.collapsed ?? false;

function clustered(tabs: Tab[]): Tab[] {
  const seen = new Set<number>();
  return tabs.flatMap((tab) => {
    if (tab.groupId === null) return [tab];
    if (seen.has(tab.groupId)) return [];
    seen.add(tab.groupId);
    return tabs.filter((other) => other.groupId === tab.groupId);
  });
}

export function barItems({ tabs, groups }: Pick<TabsState, "tabs" | "groups">): BarItem[] {
  return tabs.flatMap((tab, index) => {
    const group = groupById(groups, tab.groupId);
    const items: BarItem[] = [];
    if (group && tabs[index - 1]?.groupId !== group.id) {
      items.push({
        kind: "chip",
        group,
        tabIds: tabs.flatMap((other) => (other.groupId === group.id ? [other.id] : [])),
      });
    }
    if (!group?.collapsed) items.push({ kind: "tab", tab, group });
    return items;
  });
}

function tidy(state: TabsState): TabsState {
  const tabs = clustered(state.tabs);
  const used = [...new Set(tabs.flatMap((tab) => tab.groupId ?? []))];
  const shownId = state.tabs.find((tab) => tab.id === state.activeId)?.groupId;
  const groups = used.flatMap((id) => {
    const group = groupById(state.groups, id);
    if (!group) return [];
    return group.id === shownId ? { ...group, collapsed: false } : group;
  });
  const selection = state.selection.filter((id) => state.tabs.some((tab) => tab.id === id));
  const renamingGroupId = groupById(groups, state.renamingGroupId) ? state.renamingGroupId : null;
  return { ...state, tabs, groups, selection, renamingGroupId };
}

const commit = (changes: Partial<TabsState>) => store.set(tidy({ ...store.get(), ...changes }));

function activate(changes: Partial<TabsState> & Pick<TabsState, "tabs">, tab: Tab) {
  commit({ ...changes, activeId: tab.id });
  navigate(tabPath(tab));
}

function activateVisible(previous: Tab[], tabs: Tab[], groups: TabGroup[], from: number) {
  const visible = tabs.filter((tab) => !isHidden(groups, tab));
  const next = visible.find((tab) => previous.indexOf(tab) > from) ?? visible[visible.length - 1];
  if (next) {
    activate({ tabs, groups }, next);
    return;
  }
  const tab = createTab(NEW_TAB_PATH);
  activate({ tabs: [...tabs, tab], groups }, tab);
}

export function openTab(path: string) {
  const tab = createTab(path);
  activate({ tabs: [...store.get().tabs, tab], selection: [] }, tab);
}

export const addTab = () => openTab(NEW_TAB_PATH);

export const openWebTab = (url: string) => openTab(webPath(url));

export function openInNewTab(path: string) {
  if (tabPath(activeTab(store.get())) === NEW_TAB_PATH) navigate(path);
  else openTab(path);
}

export const openBrowserTab = () => openInNewTab(BROWSER_PATH);

function position(tabs: Tab[], id: number): number {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) throw new Error(`Tab ${id} is missing.`);
  return index;
}

export function selectTab(id: number) {
  const { tabs } = store.get();
  activate({ tabs, selection: [] }, tabs[position(tabs, id)]);
}

export function toggleTabSelected(id: number) {
  const { selection, activeId } = store.get();
  const current = selection.length > 0 ? selection : [activeId];
  commit({ selection: current.includes(id) ? current.filter((other) => other !== id) : [...current, id] });
}

export function selectTabRange(id: number) {
  const { tabs, groups, activeId } = store.get();
  const visible = tabs.filter((tab) => !isHidden(groups, tab));
  const from = visible.findIndex((tab) => tab.id === activeId);
  const to = visible.findIndex((tab) => tab.id === id);
  if (from === to || from < 0 || to < 0) {
    commit({ selection: [] });
    return;
  }
  commit({ selection: visible.slice(Math.min(from, to), Math.max(from, to) + 1).map((tab) => tab.id) });
}

export function clearTabSelection() {
  if (store.get().selection.length > 0) commit({ selection: [] });
}

function lastIndexWhere<T>(items: T[], matches: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) if (matches(items[index])) return index;
  return -1;
}

type Placement = (rest: Tab[], from: number) => number;

function place(tabs: Tab[], ids: ReadonlySet<number>, groupId: number | null, at: Placement): Tab[] {
  const moved = tabs
    .filter((tab) => ids.has(tab.id))
    .map((tab) => (tab.groupId === groupId ? tab : { ...tab, groupId }));
  const rest = tabs.filter((tab) => !ids.has(tab.id));
  const index = at(
    rest,
    tabs.findIndex((tab) => ids.has(tab.id)),
  );
  return [...rest.slice(0, index), ...moved, ...rest.slice(index)];
}

const afterGroup =
  (groupId: number): Placement =>
  (rest, from) => {
    const last = lastIndexWhere(rest, (tab) => tab.groupId === groupId);
    return last < 0 ? from : last + 1;
  };

const before =
  (item: BarItem | undefined): Placement =>
  (rest, from) => {
    if (!item) return rest.length;
    const index = item.kind === "tab" ? rest.indexOf(item.tab) : rest.findIndex((tab) => tab.groupId === item.group.id);
    return index < 0 ? from : index;
  };

function rearrange(tabs: Tab[]) {
  const current = store.get().tabs;
  const next = clustered(tabs);
  if (next.length === current.length && next.every((tab, index) => tab === current[index])) return;
  commit({ tabs: next });
}

const withoutTab = (items: BarItem[], id: number) => items.filter((item) => item.kind !== "tab" || item.tab.id !== id);

function slotGroup(prev: BarItem | undefined, next: BarItem | undefined, own: number | null): number | null {
  if (next?.kind === "tab" && next.group) return next.group.id;
  if (prev?.kind === "chip" && !prev.group.collapsed) return prev.group.id;
  return prev?.kind === "tab" && prev.group !== undefined && prev.group.id === own ? own : null;
}

export function moveTabToSlot(id: number, slot: number) {
  const state = store.get();
  const items = withoutTab(barItems(state), id);
  const own = state.tabs[position(state.tabs, id)].groupId;
  rearrange(place(state.tabs, new Set([id]), slotGroup(items[slot - 1], items[slot], own), before(items[slot])));
}

export function moveGroupToSlot(groupId: number, slot: number) {
  const state = store.get();
  const units = barItems(state).filter(
    (item) => (item.kind === "chip" && item.group.id !== groupId) || (item.kind === "tab" && !item.group),
  );
  const members = new Set(state.tabs.flatMap((tab) => (tab.groupId === groupId ? [tab.id] : [])));
  rearrange(place(state.tabs, members, groupId, before(units[slot])));
}

function freeGroupName(groups: TabGroup[]): string {
  const taken = new Set(groups.map((group) => group.name.trim().toLowerCase()));
  for (let n = 0; ; n++) {
    const name = n === 0 ? NEW_GROUP_NAME : `${NEW_GROUP_NAME} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

export function groupTabs(ids: number[]): number {
  const { tabs, groups } = store.get();
  const group: TabGroup = { id: nextGroupId++, name: freeGroupName(groups), collapsed: false };
  commit({
    tabs: tabs.map((tab) => (ids.includes(tab.id) ? { ...tab, groupId: group.id } : tab)),
    groups: [...groups, group],
    selection: [],
  });
  return group.id;
}

export function addTabsToGroup(ids: number[], groupId: number) {
  const { tabs } = store.get();
  commit({ tabs: place(tabs, new Set(ids), groupId, afterGroup(groupId)), selection: [] });
}

export function removeTabsFromGroups(ids: number[]) {
  let { tabs } = store.get();
  const groupIds = new Set(tabs.flatMap((tab) => (ids.includes(tab.id) ? (tab.groupId ?? []) : [])));
  for (const groupId of groupIds) {
    const leaving = new Set(tabs.flatMap((tab) => (ids.includes(tab.id) && tab.groupId === groupId ? [tab.id] : [])));
    tabs = place(tabs, leaving, null, afterGroup(groupId));
  }
  commit({ tabs, selection: [] });
}

export function dropTabOnItem(id: number, index: number) {
  const state = store.get();
  const item = withoutTab(barItems(state), id)[index];
  if (item.kind === "chip") {
    addTabsToGroup([id], item.group.id);
  } else if (!item.group) {
    startRenamingGroup(groupTabs([item.tab.id, id]));
  } else {
    rearrange(place(state.tabs, new Set([id]), item.group.id, (rest) => rest.indexOf(item.tab) + 1));
  }
}

export function setGroupCollapsed(id: number, collapsed: boolean) {
  const state = store.get();
  const groups = state.groups.map((group) => (group.id === id ? { ...group, collapsed } : group));
  if (collapsed && activeTab(state).groupId === id) {
    activateVisible(state.tabs, state.tabs, groups, position(state.tabs, state.activeId));
  } else {
    commit({ groups });
  }
}

export const startRenamingGroup = (id: number) => commit({ renamingGroupId: id });

export function renameGroup(id: number, input: string) {
  const name = input.trim();
  const { groups } = store.get();
  commit({
    renamingGroupId: null,
    groups: name === "" ? groups : groups.map((group) => (group.id === id ? { ...group, name } : group)),
  });
}

export function addTabToGroup(groupId: number) {
  const tab = createTab(NEW_TAB_PATH, groupId);
  activate({ tabs: [...store.get().tabs, tab] }, tab);
}

function closeTabs(keep: (tabs: Tab[]) => Tab[]) {
  const { tabs: current, groups, activeId } = store.get();
  const tabs = keep(current);
  if (tabs.length === current.length) return;
  if (tabs.some((tab) => tab.id === activeId)) {
    commit({ tabs });
  } else if (tabs.some((tab) => !isHidden(groups, tab))) {
    activateVisible(current, tabs, groups, position(current, activeId));
  } else {
    const tab = blankTab(activeId);
    const at = current.slice(0, position(current, activeId)).filter((other) => tabs.includes(other)).length;
    activate({ tabs: [...tabs.slice(0, at), tab, ...tabs.slice(at)] }, tab);
  }
}

export const closeTabsById = (ids: number[]) => closeTabs((tabs) => tabs.filter((tab) => !ids.includes(tab.id)));

export const closeTab = (id: number) => closeTabsById([id]);

export const closeGroup = (groupId: number) => closeTabs((tabs) => tabs.filter((tab) => tab.groupId !== groupId));

export const closeOtherTabs = (id: number) => closeTabs((tabs) => tabs.filter((tab) => tab.id === id));

export const closeTabsToRight = (id: number) => closeTabs((tabs) => tabs.slice(0, position(tabs, id) + 1));

export const closeTabsToLeft = (id: number) => closeTabs((tabs) => tabs.slice(position(tabs, id)));

export const closeAllTabs = () => closeTabs(() => []);

export const closeActiveTab = () => closeTab(store.get().activeId);

function moveActive(step: -1 | 1) {
  const state = store.get();
  const tab = activeTab(state);
  const index = tab.index + step;
  if (index < 0 || index >= tab.entries.length) return;
  const moved = { ...tab, index };
  activate({ tabs: state.tabs.map((current) => (current.id === tab.id ? moved : current)) }, moved);
}

export const goBack = () => moveActive(-1);

export const goForward = () => moveActive(1);

function withoutPaths(tab: Tab, paths: ReadonlySet<string>): Tab {
  const entries: string[] = [];
  let index = 0;
  tab.entries.forEach((entry, i) => {
    if (!paths.has(entry) && entry !== entries[entries.length - 1]) entries.push(entry);
    if (i === tab.index) index = Math.max(entries.length - 1, 0);
  });
  if (entries.length === 0) return { ...tab, entries: [NEW_TAB_PATH], index: 0 };
  if (landsOnSettings(tab, paths, entries[index])) {
    index += 1;
    entries.splice(index, 0, NEW_TAB_PATH);
  }
  return { ...tab, entries, index };
}

export function forgetPaths(paths: string[]) {
  const state = store.get();
  const forgotten = new Set(paths);
  const tabs = state.tabs.map((tab) => withoutPaths(tab, forgotten));
  activate({ tabs }, activeTab({ ...state, tabs }));
}

function visit(tab: Tab, path: string): Tab {
  if (tabPath(tab) === path) return tab;
  const kept = tab.entries.slice(0, tab.index + (replacesNewTab(tab, path) ? 0 : 1));
  return { ...tab, entries: [...kept, path], index: kept.length };
}

export function followPage(id: number, url: string, replace: boolean) {
  const path = webPath(url);
  const state = store.get();
  const tab = state.tabs.find((candidate) => candidate.id === id);
  if (!tab || matchWeb(tabPath(tab)) === null || tabPath(tab) === path) return;
  const moved = replace
    ? { ...tab, entries: tab.entries.map((entry, index) => (index === tab.index ? path : entry)) }
    : visit(tab, path);
  const tabs = state.tabs.map((current) => (current === tab ? moved : current));
  if (id === state.activeId) activate({ tabs }, moved);
  else commit({ tabs });
}

const KEEPS_SELECTION = '[data-tab-id], [role="menu"]';

const saveSession = saveWhenChanged(() => sessionSnapshot(store.get()), saveTabSession);

export const saveTabs = async () => {
  if (!persisting) return;
  await saveSession();
  dismissToast(TAB_SESSION_TOAST);
};

const persist = () => void saveTabs().catch((e: unknown) => showError(e, TAB_SESSION_TOAST));

export function startTabs(saved: SavedTabSession | null, persistSession: boolean) {
  const restored = restoreSession(saved, currentPath());
  nextId = restored.tabs.reduce((max, tab) => Math.max(max, tab.id), 0) + 1;
  nextGroupId = restored.groups.reduce((max, group) => Math.max(max, group.id), 0) + 1;
  store.set(tidy({ ...restored, selection: [], renamingGroupId: null }));
  navigate(tabPath(activeTab(store.get())));
  subscribeToPath(() => {
    const path = currentPath();
    const { tabs, activeId } = store.get();
    commit({ tabs: tabs.map((tab) => (tab.id === activeId ? visit(tab, path) : tab)) });
  });
  onPointerDownOutside(KEEPS_SELECTION, clearTabSelection);
  if (!persistSession) return;
  persisting = true;
  store.subscribe(persist);
  persist();
}
