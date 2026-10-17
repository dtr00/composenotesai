import type { SettingGroup, StorageUsage } from "../../../shared/api/storage";
import { AI_SETTINGS_PATH, VOICE_SETTINGS_PATH } from "../../../shared/config/routes";
import { formatBytes } from "../../../shared/lib/format-bytes";

interface StoragePart {
  label: string;
  bytes: number;
  count?: number;
}

export interface StorageArea {
  key: string;
  label: string;
  fill: string;
  track: string;
  bytes: number;
  parts: StoragePart[];
  description?: string;
  warning?: string;
}

interface AreaText {
  description?: string;
  warning?: string;
}

const SETTING_GROUPS: [SettingGroup, string][] = [
  ["general", "General"],
  ["appearance", "Appearance"],
  ["keybindings", "Keybindings"],
  ["trash", "Trash"],
  ["ai", "AI"],
  ["other", "Other"],
];

const WEBVIEW_LABELS: Record<string, string> = {
  WebKitCache: "Network cache",
  CacheStorage: "Cache storage",
  storage: "Site storage",
  "hsts-storage.sqlite": "HTTPS list",
  mediakeys: "Media keys",
  EBWebView: "WebView2 data",
};

const sum = (parts: { bytes: number }[]) => parts.reduce((total, part) => total + part.bytes, 0);

const settingsParts = (usage: StorageUsage): StoragePart[] =>
  SETTING_GROUPS.map(([group, label]) => ({
    label,
    bytes: sum(usage.settings.filter((setting) => setting.group === group)),
  }));

function area(
  key: string,
  label: string,
  [fill, track]: [string, string],
  parts: StoragePart[],
  text: AreaText = {},
): StorageArea {
  const kept = parts.filter((part) => part.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  return { key, label, fill, track, bytes: sum(kept), parts: kept, ...text };
}

interface ManageLink {
  href: string;
  label: string;
}

export interface ModelGroup {
  key: string;
  label: string;
  manage: ManageLink;
  parts: StoragePart[];
  bytes: number;
}

const APP_DEV_WARNING = "Development build. A debug build of the app is much larger than a release build.";
const WEBVIEW_DEV_WARNING =
  "Development build. This includes the dev server cache, so it is larger than in a release build.";

export function storageAreas(usage: StorageUsage, dev: boolean): StorageArea[] {
  const { notes, ai } = usage;
  const settings = settingsParts(usage);
  const storedNotes = notes.noteBytes + notes.folderBytes;
  const aiData = ai.chatBytes + ai.skillBytes;
  const structure = usage.databaseBytes - storedNotes - notes.mediaBytes - notes.trashBytes - sum(settings) - aiData;
  return [
    area(
      "app",
      "Application",
      ["bg-storage-5", "bg-storage-5/20"],
      [{ label: "Compose Notes AI", bytes: usage.appBytes }],
      { description: "The installed app itself.", warning: dev ? APP_DEV_WARNING : undefined },
    ),
    area(
      "notes",
      "Notes",
      ["bg-storage-1", "bg-storage-1/20"],
      [
        { label: "Notes", bytes: notes.noteBytes, count: notes.notes },
        { label: "Folders", bytes: notes.folderBytes, count: notes.folders },
        { label: "Media", bytes: notes.mediaBytes, count: notes.media },
        { label: "Trash", bytes: notes.trashBytes },
      ],
      {
        description: `${formatBytes(notes.textBytes)} uncompressed, ${formatBytes(storedNotes)} compressed.`,
      },
    ),
    area(
      "ai-data",
      "AI chats and skills",
      ["bg-storage-6", "bg-storage-6/20"],
      [
        { label: "Chats", bytes: ai.chatBytes, count: ai.chats },
        { label: "Skills", bytes: ai.skillBytes },
      ],
      { description: "Chats are compressed. Manage skills in Settings > AI." },
    ),
    area(
      "settings",
      "Settings",
      ["bg-storage-2", "bg-storage-2/20"],
      [...settings, { label: "Background image", bytes: usage.backgroundBytes }],
    ),
    area(
      "database",
      "Database",
      ["bg-storage-3", "bg-storage-3/20"],
      [
        { label: "Structure", bytes: structure },
        { label: "Recent changes", bytes: usage.logBytes },
      ],
    ),
    area(
      "webview",
      "Web view data",
      ["bg-storage-4", "bg-storage-4/20"],
      usage.webview.map(({ name, bytes }) => ({ label: WEBVIEW_LABELS[name] ?? name, bytes })),
      { warning: dev ? WEBVIEW_DEV_WARNING : undefined },
    ),
  ].filter((entry) => entry.bytes > 0);
}

function modelGroup(key: string, label: string, manage: ManageLink, parts: StoragePart[]): ModelGroup {
  const kept = parts.filter((part) => part.bytes > 0);
  return { key, label, manage, parts: kept, bytes: sum(kept) };
}

export function modelGroups(usage: StorageUsage): ModelGroup[] {
  return [
    modelGroup(
      "ai",
      "AI models",
      { href: AI_SETTINGS_PATH, label: "Manage AI models" },
      usage.languageModels.map(({ name, bytes }) => ({ label: name, bytes })),
    ),
    modelGroup("engine", "AI engine", { href: AI_SETTINGS_PATH, label: "Manage the AI engine" }, [
      { label: "llama.cpp", bytes: usage.engineBytes },
    ]),
    modelGroup(
      "speech",
      "Speech models",
      { href: VOICE_SETTINGS_PATH, label: "Manage speech models" },
      usage.speechModels.map(({ name, bytes }) => ({ label: name, bytes })),
    ),
  ].filter((group) => group.bytes > 0);
}
