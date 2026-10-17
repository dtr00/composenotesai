import { saveSettings, type AiSettings, type Settings } from "../../../shared/api/settings";
import { dismissToast, showError } from "../../../shared/lib/error-toast";
import { saveWhenChanged } from "../../../shared/lib/serialize-saves";
import { createStore, useStore, type Store } from "../../../shared/lib/store";
import { applyAccentColor } from "../lib/accent-color";
import { applySurfaceColors } from "../lib/surface-colors";
import { followTheme } from "../lib/theme";

const SAVE_TOAST = "settings-save";

let store: Store<Settings> | undefined;
let stopTheme = () => {};
let applied: Settings | null = null;

function started(): Store<Settings> {
  if (!store) throw new Error("Settings are used before startSettings loaded them.");
  return store;
}

function applyLook(settings: Settings) {
  const previous = applied;
  applied = settings;
  if (settings.theme !== previous?.theme) {
    stopTheme();
    stopTheme = followTheme(settings.theme);
  }
  if (settings.accentColor !== previous?.accentColor) applyAccentColor(settings.accentColor);
  if (settings.sidebarColor !== previous?.sidebarColor || settings.panelColor !== previous?.panelColor)
    applySurfaceColors({ sidebar: settings.sidebarColor, panel: settings.panelColor });
}

export function startSettings(settings: Settings) {
  store = createStore(settings);
  applyLook(settings);
}

export const getSettings = () => started().get();

const save = saveWhenChanged(getSettings, saveSettings);

export const watchSettings = (listener: (settings: Settings) => void) =>
  started().subscribe(() => listener(getSettings()));

export const useSettings = (): Settings => useStore(started());

export function previewSettings(changes: Partial<Settings>) {
  const settings = { ...getSettings(), ...changes };
  started().set(settings);
  applyLook(settings);
}

export function updateSettings(changes: Partial<Settings>) {
  previewSettings(changes);
  save().then(
    () => dismissToast(SAVE_TOAST),
    (e: unknown) => showError(e, SAVE_TOAST),
  );
}

export const updateAiSettings = (changes: Partial<AiSettings>) =>
  updateSettings({ ai: { ...getSettings().ai, ...changes } });

export const previewLook = (changes: Partial<Settings>) => applyLook({ ...getSettings(), ...changes });
