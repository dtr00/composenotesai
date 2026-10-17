import type { SavedTabSession } from "../../../shared/api/tab-session";
import { NEW_TAB_PATH } from "../../../shared/config/routes";

export function sessionSnapshot({ tabs, groups, activeId }: SavedTabSession): SavedTabSession {
  const kept = tabs.filter((tab) => tab.groupId !== null || tab.entries[tab.index] !== NEW_TAB_PATH);
  return { tabs: kept, groups, activeId: kept.some((tab) => tab.id === activeId) ? activeId : null };
}

export function restoreSession(saved: SavedTabSession | null, path: string) {
  const tabs = [...(saved?.tabs ?? [])];
  const groups = saved?.groups ?? [];
  const active =
    path !== NEW_TAB_PATH
      ? tabs.find((tab) => tab.entries[tab.index] === path)
      : (tabs.find((tab) => tab.id === saved?.activeId) ??
        tabs.find((tab) => !groups.some((group) => group.id === tab.groupId && group.collapsed)));
  if (active) return { tabs, groups, activeId: active.id };
  const id = tabs.reduce((max, tab) => Math.max(max, tab.id), 0) + 1;
  tabs.push({ id, entries: [path], index: 0, groupId: null });
  return { tabs, groups, activeId: id };
}
