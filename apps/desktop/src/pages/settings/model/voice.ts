import { getSettings, updateSettings } from "../../../entities/settings/model/settings-store";
import {
  cancelSpeechModelDownload,
  deleteSpeechModel,
  downloadSpeechModel,
  listMicrophones,
  listSpeechModels,
  loadVoiceShortcuts,
  onVoiceShortcutsChanged,
  setUpVoiceShortcuts,
  setVoiceShortcut,
  startMicrophoneTest,
  stopMicrophoneTest,
  type Microphone,
  type ShortcutBinding,
  type SpeechModel,
  type VoiceShortcuts,
} from "../../../shared/api/voice";
import type { DownloadProgress } from "../../../shared/api/download";
import { trackDownload, withEntry } from "../../../shared/lib/download-progress";
import { reportAction, reportSucceeded } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

const TEST_LIMIT_MS = 30_000;

interface VoiceState {
  microphones: Microphone[];
  shortcuts: VoiceShortcuts | null;
  settingUpShortcut: boolean;
  models: SpeechModel[];
  downloads: Record<string, DownloadProgress>;
  testing: boolean;
  level: number;
}

const store = createStore<VoiceState>({
  microphones: [],
  shortcuts: null,
  settingUpShortcut: false,
  models: [],
  downloads: {},
  testing: false,
  level: 0,
});

let testTimer: number | undefined;

export const useVoice = () => useStore(store);

async function refreshModels() {
  updateStore(store, { models: await listSpeechModels() });
}

export function refreshVoice() {
  void reportAction(
    Promise.all([listMicrophones(), loadVoiceShortcuts(), refreshModels()]).then(([microphones, shortcuts]) =>
      updateStore(store, { microphones, shortcuts }),
    ),
  );
}

export const chooseMicrophone = (id: string | null) => updateSettings({ micDevice: id });

async function applyShortcuts(work: () => Promise<VoiceShortcuts>) {
  if (store.get().settingUpShortcut) return;
  updateStore(store, { settingUpShortcut: true });
  const shortcuts = await reportAction(work());
  updateStore(store, { settingUpShortcut: false, ...(shortcuts ? { shortcuts } : {}) });
}

export const changeShortcut = (binding: ShortcutBinding, hotkey: string | null) =>
  applyShortcuts(() => setVoiceShortcut(binding, hotkey));

export const setUpShortcut = () => applyShortcuts(setUpVoiceShortcuts);

export const chooseModel = (id: string) => updateSettings({ voiceModel: id });

const progressOf = (id: string) => (progress: DownloadProgress | null) =>
  updateStore(store, { downloads: withEntry(store.get().downloads, id, progress) });

export const downloadModel = (id: string) =>
  reportAction(
    trackDownload(progressOf(id), async (onProgress) => {
      const finished = await downloadSpeechModel(id, onProgress);
      await refreshModels();
      if (finished && !getSettings().voiceModel) chooseModel(id);
    }),
  );

export const cancelDownload = (id: string) => void cancelSpeechModelDownload(id);

export async function removeModel(id: string) {
  if (!(await reportSucceeded(deleteSpeechModel(id)))) return;
  if (getSettings().voiceModel === id) updateSettings({ voiceModel: null });
  await reportAction(refreshModels());
}

export async function stopTest() {
  window.clearTimeout(testTimer);
  if (!store.get().testing) return;
  updateStore(store, { testing: false, level: 0 });
  await reportAction(stopMicrophoneTest());
}

export async function startTest() {
  const started = await reportSucceeded(
    startMicrophoneTest((peak) => updateStore(store, { level: Math.min(1, Math.sqrt(peak)) })),
  );
  if (!started) return;
  updateStore(store, { testing: true });
  testTimer = window.setTimeout(() => void stopTest(), TEST_LIMIT_MS);
}

export const toggleTest = () => (store.get().testing ? stopTest() : startTest());

export function followVoiceSettings() {
  let disposed = false;
  const listening = onVoiceShortcutsChanged((shortcuts) => {
    if (!disposed) updateStore(store, { shortcuts });
  });
  void reportAction(
    listening.then(() => {
      if (!disposed) refreshVoice();
    }),
  );
  return () => {
    disposed = true;
    void reportAction(listening.then((unlisten) => unlisten()));
    void stopTest();
  };
}
