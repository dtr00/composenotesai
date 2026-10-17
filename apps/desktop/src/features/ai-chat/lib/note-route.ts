import { matchEntry } from "../../../shared/config/routes";

export function noteIdIn(path: string): number | null {
  const route = matchEntry(path);
  return route?.kind === "note" ? route.id : null;
}
