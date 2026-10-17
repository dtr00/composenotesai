import { cancelDictation, startDictation, stopDictation } from "../../../shared/api/voice";
import { showError } from "../../../shared/lib/error-toast";
import { createRecordingMeter } from "../../../shared/lib/recording-meter";
import { createStore, useStore } from "../../../shared/lib/store";
import { sendMessage, setDraft } from "./chat-store";

const LEVEL_BARS = 24;

type VoiceMessageState = "idle" | "starting" | "recording" | "transcribing";

const state = createStore<VoiceMessageState>("idle");

export const voiceMessageMeter = createRecordingMeter(LEVEL_BARS);

let session = 0;

export const useVoiceMessageState = () => useStore(state);

function finish() {
  voiceMessageMeter.stop();
  state.set("idle");
}

export async function startVoiceMessage() {
  if (state.get() !== "idle") return;
  const recording = ++session;
  state.set("starting");
  try {
    await startDictation(voiceMessageMeter.push);
  } catch (e) {
    if (recording !== session) return;
    finish();
    showError(e);
    return;
  }
  if (recording !== session) {
    void cancelDictation();
    return;
  }
  voiceMessageMeter.start();
  state.set("recording");
}

export function cancelVoiceMessage() {
  const current = state.get();
  if (current === "idle") return;
  session++;
  finish();
  if (current === "recording") void cancelDictation();
}

async function transcribe(): Promise<string | null> {
  if (state.get() !== "recording") return null;
  const recording = session;
  voiceMessageMeter.stop();
  state.set("transcribing");
  let text: string;
  try {
    text = await stopDictation();
  } catch (e) {
    if (recording === session) finish();
    showError(e);
    return null;
  }
  if (recording !== session) return null;
  finish();
  if (text.trim()) return text;
  showError("No speech was heard.");
  return null;
}

export async function stopVoiceMessage() {
  const text = await transcribe();
  if (text) setDraft(text);
}

export async function sendVoiceMessage() {
  const text = await transcribe();
  if (text) void sendMessage(text);
}
