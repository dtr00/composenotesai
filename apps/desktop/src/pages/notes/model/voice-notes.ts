import { createElement } from "react";
import { toast } from "sonner";
import { loadNoteList } from "../../../entities/note/model/note-list-store";
import { openTab } from "../../../features/tabs/model/tabs-store";
import { startVoiceNote } from "../../../features/voice-note/model/voice-note";
import { onVoiceNoteSaved, type VoiceStatus } from "../../../shared/api/voice";
import { notePath } from "../../../shared/config/routes";
import { VoiceNoteToast } from "../ui/voice-note-toast";

const TOAST_ID = "voice-status";

const DURATIONS: Record<VoiceStatus["state"], number> = {
  recording: Infinity,
  transcribing: Infinity,
  saved: 8000,
  cancelled: 3000,
  failed: Infinity,
};

function openSaved(id: number) {
  openTab(notePath(id));
  toast.dismiss(TOAST_ID);
}

function show(status: VoiceStatus) {
  const onOpen = status.state === "saved" ? () => openSaved(status.id) : undefined;
  toast.custom(() => createElement(VoiceNoteToast, { onOpen }), { id: TOAST_ID, duration: DURATIONS[status.state] });
}

export function listenForVoiceNotes() {
  void onVoiceNoteSaved(() => void loadNoteList());
  void startVoiceNote(show);
}
