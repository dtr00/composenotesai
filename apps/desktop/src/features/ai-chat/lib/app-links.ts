import type { EntryRef } from "../../../shared/api/notes";
import { matchEntry, SETTINGS_PATH } from "../../../shared/config/routes";

export type AppLink = { kind: "entry"; ref: EntryRef } | { kind: "page"; path: string };

const ENTRY_LINK = /^(note|folder|file|media|image|video|document):(\d+)$/;
const SETTINGS_LINK = /^settings(?::([\w/-]*))?$/;
const HASH_LINK = /^#(\/.*)$/;

const ENTRY_KINDS: Record<string, EntryRef["kind"]> = { note: "note", folder: "folder" };

export function appLink(href: string): AppLink | null {
  const entry = ENTRY_LINK.exec(href);
  if (entry) return { kind: "entry", ref: { kind: ENTRY_KINDS[entry[1]] ?? "media", id: Number(entry[2]) } };
  const settings = SETTINGS_LINK.exec(href);
  if (settings) {
    const section = settings[1]?.replace(/^\/+|\/+$/g, "");
    return { kind: "page", path: section && section !== "general" ? `${SETTINGS_PATH}/${section}` : SETTINGS_PATH };
  }
  const hash = HASH_LINK.exec(href);
  if (!hash) return null;
  const ref = matchEntry(hash[1]);
  return ref ? { kind: "entry", ref } : { kind: "page", path: hash[1] };
}

const MEDIA_LINK = /^(?:file|media|image):(\d+)$/;

export const mediaLinkId = (href: string): number | null => {
  const media = MEDIA_LINK.exec(href);
  return media ? Number(media[1]) : null;
};
