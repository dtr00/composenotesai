import { tabPath, useActiveTab } from "../../../features/tabs/model/tabs-store";
import { BROWSER_PATH, matchEntry, matchWeb } from "../../../shared/config/routes";
import { useNotes, type OpenNote } from "./notes-store";

export type NotesView =
  | { kind: "folder"; id: number }
  | { kind: "media"; id: number }
  | { kind: "note"; note: OpenNote }
  | { kind: "browser"; tab: number }
  | { kind: "web"; tab: number; url: string }
  | { kind: "empty" };

export function useNotesView(): NotesView {
  const tab = useActiveTab();
  const { open } = useNotes();
  const path = tabPath(tab);
  if (path === BROWSER_PATH) return { kind: "browser", tab: tab.id };
  const url = matchWeb(path);
  if (url !== null) return { kind: "web", tab: tab.id, url };
  const route = matchEntry(path);
  if (route?.kind === "folder" || route?.kind === "media") return { kind: route.kind, id: route.id };
  return open ? { kind: "note", note: open } : { kind: "empty" };
}
