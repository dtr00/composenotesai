import type { LucideIcon } from "lucide-react";
import { HOTKEY_ACTIONS, type HotkeyAction } from "../../../entities/settings/model/keybindings";
import {
  AI_SETTINGS_PATH,
  APPEARANCE_SETTINGS_PATH,
  KEYBINDINGS_SETTINGS_PATH,
  SETTINGS_PATH,
  STORAGE_SETTINGS_PATH,
  SYSTEM_SETTINGS_PATH,
  VOICE_SETTINGS_PATH,
} from "../../../shared/config/routes";
import { currentPath, navigate } from "../../../shared/lib/hash-router";
import { sectionLabel, SETTINGS_SECTIONS, type SectionPath } from "./settings-sections";

const REVEAL_MS = 1600;

export const SETTING_IDS = {
  about: "setting-about",
  attachmentFolder: "setting-attachment-folder",
  searchEngine: "setting-search-engine",
  browserCache: "setting-browser-cache",
  browserCacheClearing: "setting-browser-cache-clearing",
  microphone: "setting-microphone",
  recordShortcut: "setting-record-shortcut",
  holdToRecord: "setting-hold-to-record",
  cancelShortcut: "setting-cancel-shortcut",
  microphoneTest: "setting-microphone-test",
  speechModel: "setting-speech-model",
  aiModel: "setting-ai-model",
  aiEdits: "setting-ai-edits",
  aiWebSearch: "setting-ai-web-search",
  aiSkills: "setting-ai-skills",
  aiAgent: "setting-ai-agent",
  aiEngine: "setting-ai-engine",
  aiModels: "setting-ai-models",
  aiProviders: "setting-ai-providers",
  aiCreativity: "setting-ai-creativity",
  aiResponseLength: "setting-ai-response-length",
  aiThinking: "setting-ai-thinking",
  aiContext: "setting-ai-context",
  aiGpu: "setting-ai-gpu",
  aiThreads: "setting-ai-threads",
  aiKeepLoaded: "setting-ai-keep-loaded",
  skills: "setting-skills",
  agentInstructions: "setting-agent-instructions",
  voiceFolder: "setting-voice-folder",
  theme: "setting-theme",
  backgroundImage: "setting-background-image",
  backgroundStyle: "setting-background-style",
  backgroundPosition: "setting-background-position",
  backgroundBlur: "setting-background-blur",
  backgroundOpacity: "setting-background-opacity",
  accentColor: "setting-accent-color",
  sidebarColor: "setting-sidebar-color",
  panelColor: "setting-panel-color",
  storage: "setting-storage",
  storageModels: "setting-storage-models",
  trash: "setting-trash",
  processor: "setting-processor",
  memory: "setting-memory",
  disk: "setting-disk",
  operatingSystem: "setting-operating-system",
} as const;

export const keybindingSettingId = (action: HotkeyAction) => `setting-keybinding-${action}`;

export interface SettingEntry {
  label: string;
  path: SectionPath;
  id: string;
  fallbackId?: string;
  keywords: string[];
}

const VERSION_SETTING: SettingEntry = {
  label: "Version",
  path: SETTINGS_PATH,
  id: SETTING_IDS.about,
  keywords: ["about", "app", "update"],
};

const background = (label: string, id: string, keywords: string[]): SettingEntry => ({
  label,
  path: APPEARANCE_SETTINGS_PATH,
  id,
  fallbackId: SETTING_IDS.backgroundImage,
  keywords: ["background", "image", ...keywords],
});

const SETTINGS: SettingEntry[] = [
  {
    label: "Attachment folder",
    path: SETTINGS_PATH,
    id: SETTING_IDS.attachmentFolder,
    keywords: [
      "media",
      "image",
      "video",
      "document",
      "pdf",
      "docx",
      "word",
      "paste",
      "photo",
      "picture",
      "screenshot",
      "attachment",
      "file",
      "location",
    ],
  },
  {
    label: "Search engine",
    path: SETTINGS_PATH,
    id: SETTING_IDS.searchEngine,
    keywords: ["browser", "web", "google", "duckduckgo", "bing", "address bar"],
  },
  {
    label: "Clear browser cache",
    path: SETTINGS_PATH,
    id: SETTING_IDS.browserCache,
    keywords: ["browser", "web", "cache", "storage", "space", "disk"],
  },
  {
    label: "Clear browser cache automatically",
    path: SETTINGS_PATH,
    id: SETTING_IDS.browserCacheClearing,
    keywords: ["browser", "web", "cache", "auto", "clean up", "schedule"],
  },
  VERSION_SETTING,
  {
    label: "Theme",
    path: APPEARANCE_SETTINGS_PATH,
    id: SETTING_IDS.theme,
    keywords: ["light", "dark", "system", "mode"],
  },
  {
    label: "Background image",
    path: APPEARANCE_SETTINGS_PATH,
    id: SETTING_IDS.backgroundImage,
    keywords: ["wallpaper", "picture", "photo"],
  },
  background("Background style", SETTING_IDS.backgroundStyle, ["dither"]),
  background("Background position", SETTING_IDS.backgroundPosition, ["zoom", "adjust", "crop"]),
  background("Background blur", SETTING_IDS.backgroundBlur, []),
  background("Background opacity", SETTING_IDS.backgroundOpacity, ["transparency"]),
  {
    label: "Accent color",
    path: APPEARANCE_SETTINGS_PATH,
    id: SETTING_IDS.accentColor,
    keywords: ["colors", "primary", "highlight", "chart"],
  },
  {
    label: "Sidebar color",
    path: APPEARANCE_SETTINGS_PATH,
    id: SETTING_IDS.sidebarColor,
    keywords: ["colors", "title bar"],
  },
  {
    label: "Panel color",
    path: APPEARANCE_SETTINGS_PATH,
    id: SETTING_IDS.panelColor,
    keywords: ["colors", "main", "background color"],
  },
  {
    label: "Microphone",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.microphone,
    keywords: ["voice", "audio", "input", "recording", "mic", "device"],
  },
  {
    label: "Recording shortcut",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.recordShortcut,
    keywords: ["voice", "note", "hotkey", "keybinding", "global", "record"],
  },
  {
    label: "Hold to record",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.holdToRecord,
    keywords: ["voice", "note", "push to talk", "press", "toggle", "release", "shortcut", "hotkey"],
  },
  {
    label: "Cancel shortcut",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.cancelShortcut,
    fallbackId: SETTING_IDS.holdToRecord,
    keywords: ["voice", "note", "hotkey", "keybinding", "global", "stop", "discard", "escape"],
  },
  {
    label: "Test microphone",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.microphoneTest,
    keywords: ["voice", "audio", "level", "check", "mic"],
  },
  {
    label: "Voice note folder",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.voiceFolder,
    keywords: ["voice", "recording", "location", "save", "directory", "notes"],
  },
  {
    label: "Speech model",
    path: VOICE_SETTINGS_PATH,
    id: SETTING_IDS.speechModel,
    keywords: ["voice", "whisper", "transcription", "download", "language", "ai", "local", "model"],
  },
  {
    label: "Default model",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiModel,
    keywords: ["ai", "llm", "assistant", "agent", "default", "choose", "switch"],
  },
  {
    label: "Let AI edit notes",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiEdits,
    keywords: ["ai", "write", "permission", "read only", "agent", "tools"],
  },
  {
    label: "Search the web",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiWebSearch,
    keywords: ["ai", "internet", "online", "research", "browse", "images", "pictures", "duckduckgo", "wikipedia"],
  },
  {
    label: "Skills",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiSkills,
    keywords: ["ai", "skill.md", "install", "instructions", "agent"],
  },
  {
    label: "Agent instructions",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiAgent,
    keywords: ["ai", "system prompt", "agent.md", "role", "personality"],
  },
  {
    label: "AI engine",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiEngine,
    keywords: ["llama.cpp", "local", "install", "runtime", "unload", "offline"],
  },
  {
    label: "Local AI models",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiModels,
    keywords: ["download", "gguf", "qwen", "gemma", "hugging face", "llm", "offline"],
  },
  {
    label: "AI servers",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiProviders,
    keywords: ["ollama", "provider", "openai", "lm studio", "vllm", "self hosted", "url", "api key", "custom"],
  },
  {
    label: "Creativity",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiCreativity,
    keywords: ["ai", "temperature", "top p", "sampling", "random"],
  },
  {
    label: "Longest answer",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiResponseLength,
    keywords: ["ai", "max tokens", "length", "limit"],
  },
  {
    label: "Think before answering",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiThinking,
    keywords: ["ai", "reasoning", "thinking"],
  },
  {
    label: "Context size",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiContext,
    keywords: ["ai", "context window", "tokens", "memory", "num_ctx"],
  },
  {
    label: "Use the graphics card",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiGpu,
    keywords: ["ai", "gpu", "vulkan", "metal", "cuda", "offload", "acceleration"],
  },
  {
    label: "Processor threads",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiThreads,
    keywords: ["ai", "cpu", "threads", "cores"],
  },
  {
    label: "Keep the model loaded",
    path: AI_SETTINGS_PATH,
    id: SETTING_IDS.aiKeepLoaded,
    keywords: ["ai", "unload", "memory", "idle", "keep alive"],
  },
  {
    label: "Storage used",
    path: STORAGE_SETTINGS_PATH,
    id: SETTING_IDS.storage,
    keywords: ["disk", "space", "size", "database", "data folder"],
  },
  {
    label: "Downloaded models",
    path: STORAGE_SETTINGS_PATH,
    id: SETTING_IDS.storageModels,
    keywords: ["disk", "space", "size", "ai", "speech", "whisper", "gguf", "engine"],
  },
  {
    label: "Deleted notes",
    path: STORAGE_SETTINGS_PATH,
    id: SETTING_IDS.trash,
    keywords: ["trash", "restore", "recycle bin", "empty", "recover", "expire", "delete after", "retention"],
  },
  {
    label: "Processor",
    path: SYSTEM_SETTINGS_PATH,
    id: SETTING_IDS.processor,
    keywords: ["cpu", "usage", "cores", "avx", "neon"],
  },
  { label: "Memory", path: SYSTEM_SETTINGS_PATH, id: SETTING_IDS.memory, keywords: ["ram", "usage", "swap"] },
  { label: "Disk", path: SYSTEM_SETTINGS_PATH, id: SETTING_IDS.disk, keywords: ["drive", "free space"] },
  {
    label: "Operating system",
    path: SYSTEM_SETTINGS_PATH,
    id: SETTING_IDS.operatingSystem,
    keywords: ["os", "version", "architecture"],
  },
  ...HOTKEY_ACTIONS.map(({ action, label, group }) => ({
    label,
    path: KEYBINDINGS_SETTINGS_PATH,
    id: keybindingSettingId(action),
    keywords: ["keybinding", "shortcut", "hotkey", group],
  })),
];

export interface SettingsResult {
  key: string;
  label: string;
  path: SectionPath;
  detail?: string;
  Icon?: LucideIcon;
  entry?: SettingEntry;
}

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

const matchesQuery = (query: string, ...texts: string[]) => {
  const haystack = texts.join(" ").toLowerCase();
  return words(query).every((word) => haystack.includes(word));
};

export const searchSettings = (query: string): SettingsResult[] => [
  ...SETTINGS_SECTIONS.filter((section) => matchesQuery(query, section.label)).map(({ path, label, Icon }) => ({
    key: path,
    label,
    path,
    Icon,
  })),
  ...SETTINGS.filter((entry) => matchesQuery(query, entry.label, sectionLabel(entry.path), ...entry.keywords)).map(
    (entry) => ({ key: entry.id, label: entry.label, path: entry.path, detail: sectionLabel(entry.path), entry }),
  ),
];

let stopWaiting = () => {};

function highlight(target: HTMLElement) {
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.dataset.revealed = "";
  window.setTimeout(() => delete target.dataset.revealed, REVEAL_MS);
}

export function revealSetting({ id, fallbackId, path }: SettingEntry) {
  stopWaiting();
  const find = () => document.getElementById(id) ?? (fallbackId ? document.getElementById(fallbackId) : null);
  const shown = currentPath() === path ? find() : null;
  if (shown) return highlight(shown);
  const waiting = new MutationObserver(() => {
    if (currentPath() !== path) return stopWaiting();
    const target = find();
    if (!target) return;
    stopWaiting();
    highlight(target);
  });
  waiting.observe(document.body, { childList: true, subtree: true });
  stopWaiting = () => waiting.disconnect();
  navigate(path);
}

export const revealVersionSetting = () => revealSetting(VERSION_SETTING);
