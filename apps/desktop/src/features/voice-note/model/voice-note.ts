import {
  loadVoiceNote,
  onVoiceLevel,
  onVoicePreview,
  onVoiceStatus,
  type VoiceStatus,
} from "../../../shared/api/voice";
import { createRecordingMeter } from "../../../shared/lib/recording-meter";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

const LEVEL_BARS = 32;

export interface VoiceNote {
  status: VoiceStatus | null;
  preview: string;
}

const store = createStore<VoiceNote>({ status: null, preview: "" });

export const voiceNoteMeter = createRecordingMeter(LEVEL_BARS);

function setStatus(status: VoiceStatus) {
  const recording = status.state === "recording";
  const started = recording && store.get().status?.state !== "recording";
  if (started) voiceNoteMeter.start();
  else if (!recording) voiceNoteMeter.stop();
  updateStore(store, started ? { status, preview: "" } : { status });
}

export async function startVoiceNote(onStatus: (status: VoiceStatus) => void = () => {}) {
  await Promise.all([
    onVoiceStatus((status) => {
      setStatus(status);
      onStatus(status);
    }),
    onVoicePreview((preview) => updateStore(store, { preview })),
    onVoiceLevel(voiceNoteMeter.push),
  ]);
  const current = await loadVoiceNote();
  if (!store.get().status && current.status) setStatus(current.status);
  if (!store.get().preview) updateStore(store, { preview: current.preview });
}

export const useVoiceNote = () => useStore(store);
