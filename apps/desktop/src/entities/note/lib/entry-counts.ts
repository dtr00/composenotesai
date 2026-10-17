import type { Entry, EntryCounts, EntryType } from "../../../shared/api/notes";
import { counted, joinWithAnd } from "../../../shared/lib/plural";
import { entryType } from "./entry-type";

const ORDER: EntryType[] = ["note", "folder", "image", "video", "document"];

export function countEntries(entries: Entry[]): EntryCounts {
  const counts: EntryCounts = {};
  for (const entry of entries) {
    const kind = entryType(entry);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

export const describeCounts = (counts: EntryCounts) =>
  joinWithAnd(ORDER.flatMap((kind) => (counts[kind] ? [counted(counts[kind], kind)] : [])));
