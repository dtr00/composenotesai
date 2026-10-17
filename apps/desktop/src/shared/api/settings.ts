import { invoke } from "@tauri-apps/api/core";

export type Theme = "system" | "light" | "dark";
export type BackgroundStyle = "image" | "dither";
export const SEARCH_ENGINES = ["google", "duckDuckGo", "bing"] as const;
export type SearchEngine = (typeof SEARCH_ENGINES)[number];

export const LOCAL_PROVIDER = "local";

export type ProviderKind = "ollama" | "openAi";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  enabled: boolean;
}

export interface ModelRef {
  provider: string;
  model: string;
}

export interface AiSettings {
  providers: ProviderConfig[];
  model: ModelRef | null;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextSize: number;
  thinking: boolean;
  allowEdits: boolean;
  useGpu: boolean;
  threads: number;
  keepLoadedMinutes: number;
  instructions: string | null;
  webSearch: boolean;
}

export interface Settings {
  sidebarOpen: boolean;
  sidebarWidth: number;
  confirmNoteDelete: boolean;
  theme: Theme;
  accentColor: string | null;
  sidebarColor: string | null;
  panelColor: string | null;
  backgroundBlur: number;
  backgroundOpacity: number;
  backgroundStyle: BackgroundStyle;
  backgroundPositionX: number;
  backgroundPositionY: number;
  backgroundZoom: number;
  keybindings: Record<string, string>;
  trashRetentionDays: number;
  mediaFolderId: number | null;
  searchEngine: SearchEngine;
  browserCacheClearHours: number;
  micDevice: string | null;
  voiceModel: string | null;
  holdToRecord: boolean;
  voiceFolderId: number | null;
  chatOpen: boolean;
  chatWidth: number;
  ai: AiSettings;
}

export const loadSettings = () => invoke<Settings>("load_settings");
export const saveSettings = (settings: Settings) => invoke<void>("save_settings", { settings });
