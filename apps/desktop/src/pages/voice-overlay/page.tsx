import { cn } from "cn";
import { VoiceNoteCard } from "../../features/voice-note/ui/voice-note-card";
import { isMacOS } from "../../shared/lib/platform";

export function VoiceOverlayPage() {
  return (
    <div className={cn("flex justify-center", !isMacOS && "pt-3")}>
      <VoiceNoteCard
        className={cn(
          "max-w-[380px]",
          isMacOS
            ? "h-screen"
            : "rounded-xl border duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-4 motion-safe:zoom-in-[0.97]",
        )}
      />
    </div>
  );
}
