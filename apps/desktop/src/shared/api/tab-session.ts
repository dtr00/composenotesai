import { invoke } from "@tauri-apps/api/core";

export interface SavedTab {
  id: number;
  entries: string[];
  index: number;
  groupId: number | null;
}

export interface SavedTabGroup {
  id: number;
  name: string;
  collapsed: boolean;
}

export interface SavedTabSession {
  tabs: SavedTab[];
  groups: SavedTabGroup[];
  activeId: number | null;
}

export const loadTabSession = () => invoke<SavedTabSession>("load_tab_session");
export const saveTabSession = (session: SavedTabSession) => invoke<void>("save_tab_session", { session });
