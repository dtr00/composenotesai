import type { EntryRef } from "../api/notes";

export const NEW_TAB_PATH = "/";
export const SETTINGS_PATH = "/settings";
export const APPEARANCE_SETTINGS_PATH = `${SETTINGS_PATH}/appearance` as const;
export const VOICE_SETTINGS_PATH = `${SETTINGS_PATH}/voice` as const;
export const AI_SETTINGS_PATH = `${SETTINGS_PATH}/ai` as const;
export const SKILLS_SETTINGS_PATH = `${AI_SETTINGS_PATH}/skills` as const;
export const AGENT_SETTINGS_PATH = `${AI_SETTINGS_PATH}/agent` as const;
export const KEYBINDINGS_SETTINGS_PATH = `${SETTINGS_PATH}/keybindings` as const;
export const STORAGE_SETTINGS_PATH = `${SETTINGS_PATH}/storage` as const;
export const SYSTEM_SETTINGS_PATH = `${SETTINGS_PATH}/system` as const;
export const TRASH_SETTINGS_PATH = `${STORAGE_SETTINGS_PATH}/trash` as const;

export const isSettingsPath = (path: string) => path === SETTINGS_PATH || path.startsWith(`${SETTINGS_PATH}/`);

const WEB_PREFIX = "/web/";

export const BROWSER_PATH = WEB_PREFIX;

export const webPath = (url: string) => `${WEB_PREFIX}${encodeURIComponent(url)}`;

export const matchWeb = (path: string): string | null =>
  path.startsWith(WEB_PREFIX) && path !== BROWSER_PATH ? decodeURIComponent(path.slice(WEB_PREFIX.length)) : null;

type EntryKind = EntryRef["kind"];

const SEGMENTS: Record<EntryKind, string> = { note: "notes", folder: "folders", media: "media" };

const ENTRY_PATH = new RegExp(`^/(${Object.values(SEGMENTS).join("|")})/(\\d+)$`);

const isEntryKind = (kind: string): kind is EntryKind => kind in SEGMENTS;

export const entryPath = ({ kind, id }: EntryRef) => `/${SEGMENTS[kind]}/${id}`;

export const notePath = (id: number) => entryPath({ kind: "note", id });

export function matchEntry(path: string): EntryRef | null {
  const match = ENTRY_PATH.exec(path);
  const kind = match && Object.entries(SEGMENTS).find(([, segment]) => segment === match[1])?.[0];
  return kind && isEntryKind(kind) ? { kind, id: Number(match[2]) } : null;
}
