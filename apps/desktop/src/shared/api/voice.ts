import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DownloadProgress } from "./download";

export interface Microphone {
  id: string;
  name: string;
}

export type ShortcutBinding = "record" | "cancel";

export interface BoundShortcut {
  hotkey: string | null;
  description: string | null;
  defaultHotkey: string;
}

export interface VoiceShortcuts {
  record: BoundShortcut;
  cancel: BoundShortcut;
  editable: boolean;
  needsSetup: boolean;
}

export interface SpeechModel {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  installed: boolean;
}

export type VoiceStatus =
  | { state: "recording"; record: string | null; cancel: string | null; hold: boolean }
  | { state: "transcribing" }
  | { state: "saved"; id: number; title: string }
  | { state: "cancelled" }
  | { state: "failed"; message: string };

export interface VoiceNoteState {
  status: VoiceStatus | null;
  preview: string;
}

export const listMicrophones = () => invoke<Microphone[]>("microphones");

export const startMicrophoneTest = (onLevel: (peak: number) => void) =>
  invoke<void>("voice_test_start", { onLevel: new Channel<number>(onLevel) });

export const stopMicrophoneTest = () => invoke<{ seconds: number }>("voice_test_stop");

export const loadVoiceShortcuts = () => invoke<VoiceShortcuts>("voice_shortcuts");

export const onVoiceShortcutsChanged = (handler: (shortcuts: VoiceShortcuts) => void) =>
  listen<VoiceShortcuts>("voice-shortcuts-changed", ({ payload }) => handler(payload));

export const setUpVoiceShortcuts = () => invoke<VoiceShortcuts>("set_up_voice_shortcuts");

export const setVoiceShortcut = (binding: ShortcutBinding, hotkey: string | null) =>
  invoke<VoiceShortcuts>("set_voice_shortcut", { binding, hotkey });

export const listSpeechModels = () => invoke<SpeechModel[]>("voice_models");

export const downloadSpeechModel = (id: string, onProgress: (progress: DownloadProgress) => void) =>
  invoke<boolean>("download_voice_model", { id, onProgress: new Channel<DownloadProgress>(onProgress) });

export const cancelSpeechModelDownload = (id: string) => invoke<void>("cancel_voice_model_download", { id });

export const deleteSpeechModel = (id: string) => invoke<void>("delete_voice_model", { id });

export const startDictation = (onLevel: (peak: number) => void) =>
  invoke<void>("voice_dictation_start", { onLevel: new Channel<number>(onLevel) });

export const stopDictation = () => invoke<string>("voice_dictation_stop");

export const cancelDictation = () => invoke<void>("voice_dictation_cancel");

export const loadVoiceNote = () => invoke<VoiceNoteState>("voice_note_state");

export const resizeVoiceOverlay = (height: number) => invoke<void>("resize_voice_overlay", { height });

export const onVoiceStatus = (handler: (status: VoiceStatus) => void) =>
  listen<VoiceStatus>("voice-status", ({ payload }) => handler(payload));

export const onVoiceNoteSaved = (handler: () => void) => listen<number>("voice-note-saved", () => handler());

export const onVoicePreview = (handler: (text: string) => void) =>
  listen<string>("voice-preview", ({ payload }) => handler(payload));

export const onVoiceLevel = (handler: (peak: number) => void) =>
  listen<number>("voice-level", ({ payload }) => handler(payload));
