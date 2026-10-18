import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startVoiceNote } from "../src/features/voice-note/model/voice-note";
import { VoiceOverlayPage } from "../src/pages/voice-overlay/page";
import type { VoiceStatus } from "../src/shared/api/voice";
import "../src/app/styles.css";
import { checker, waitFor } from "./browser-kit";

export async function testVoiceOverlay() {
  const { check, passed } = checker();
  const recording: VoiceStatus = { state: "recording", record: "Ctrl+Alt+R", cancel: "Ctrl+Alt+C", hold: false };
  const heights: number[] = [];
  mockWindows("voice-overlay");
  mockIPC(
    (command, payload) => {
      if (command === "resize_voice_overlay" && typeof payload?.height === "number") heights.push(payload.height);
      return { status: recording, preview: "" };
    },
    { shouldMockEvents: true },
  );
  await startVoiceNote();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const status = () => container.querySelector('[role="status"]');
  const change = async (next: VoiceStatus) => {
    await emit("voice-status", next);
    await waitFor(() => status()?.textContent === (next.state === "transcribing" ? "Transcribing" : "Recording"));
  };
  try {
    flushSync(() => root.render(createElement(VoiceOverlayPage)));
    check(container.textContent?.includes("Listening…") === true, "Recording shows its transcript and shortcuts");
    const card = status()?.closest("header")?.parentElement;
    if (!card) throw new Error("Voice card missing");
    const before = card.getBoundingClientRect();
    await waitFor(() => heights.length > 0);
    const recordingHeight = heights.at(-1) ?? 0;
    await change({ state: "transcribing" });
    check(status()?.closest("header")?.parentElement === card, "Transcribing updates the existing popup");
    check(!container.querySelector("footer"), "Recording shortcuts leave when transcription starts");
    check(!container.textContent?.includes("Listening…"), "The listening prompt leaves when transcription starts");
    check(container.querySelectorAll('[role="status"]').length === 1, "Only one voice status is rendered");
    const after = card.getBoundingClientRect();
    check(after.height < before.height, "The transcribing card shrinks to fit its content");
    await waitFor(() => (heights.at(-1) ?? recordingHeight) < recordingHeight);
    check(
      (heights.at(-1) ?? recordingHeight) < recordingHeight,
      "The native window shrinks with the card to remove the old recording area",
    );
    check(getComputedStyle(card).animationName === "none", "The transparent card does not animate its painted bounds");
    await change(recording);
    await waitFor(() => heights.at(-1) === recordingHeight);
    check(container.textContent?.includes("Listening…") === true, "A second recording restores its controls");
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    clearMocks();
  }
  return passed;
}
