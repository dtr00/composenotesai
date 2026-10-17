import type { Settings } from "../src/shared/api/settings";

export function checker() {
  const passed: string[] = [];
  const check = (condition: boolean, description: string) => {
    if (!condition) throw new Error(description);
    passed.push(description);
  };
  return { passed, check };
}

export async function waitFor(condition: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Browser check timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export const testSettings = (overrides: Partial<Settings> = {}): Settings => ({
  sidebarOpen: true,
  sidebarWidth: 240,
  confirmNoteDelete: true,
  theme: "light",
  accentColor: null,
  sidebarColor: null,
  panelColor: null,
  backgroundBlur: 0,
  backgroundOpacity: 0,
  backgroundStyle: "image",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  backgroundZoom: 100,
  keybindings: {},
  trashRetentionDays: 30,
  mediaFolderId: null,
  searchEngine: "google",
  browserCacheClearHours: 24,
  micDevice: null,
  voiceModel: null,
  holdToRecord: false,
  voiceFolderId: null,
  chatOpen: false,
  chatWidth: 380,
  ai: {
    providers: [],
    model: null,
    temperature: 0.6,
    topP: 0.95,
    maxTokens: 2048,
    contextSize: 8192,
    thinking: false,
    allowEdits: true,
    useGpu: true,
    threads: 0,
    keepLoadedMinutes: 5,
    instructions: null,
    webSearch: false,
  },
  ...overrides,
});
