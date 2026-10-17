import type { Entry, EntryType } from "../../../shared/api/notes";

export const entryType = (entry: Entry): EntryType => (entry.kind === "media" ? entry.mediaType : entry.kind);
