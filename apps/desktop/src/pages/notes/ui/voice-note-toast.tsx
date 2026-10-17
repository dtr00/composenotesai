import { VoiceNoteCard } from "../../../features/voice-note/ui/voice-note-card";
import { Button } from "../../../shared/ui/button";

export function VoiceNoteToast({ onOpen }: { onOpen?: () => void }) {
  return (
    <VoiceNoteCard
      className="w-(--width) rounded-xl border shadow-lg"
      action={
        onOpen && (
          <Button variant="outline" onClick={onOpen}>
            Open
          </Button>
        )
      }
    />
  );
}
