import { cn } from "cn";
import { VoiceNoteCard } from "../../features/voice-note/ui/voice-note-card";
import { resizeVoiceOverlay } from "../../shared/api/voice";
import { isMacOS } from "../../shared/lib/platform";

function fitWindow(container: HTMLDivElement | null) {
  if (!container) return;
  const observer = new ResizeObserver(() => {
    const height = container.getBoundingClientRect().height;
    if (height > 0) resizeVoiceOverlay(height).catch((error: unknown) => console.error(error));
  });
  observer.observe(container);
  return () => observer.disconnect();
}

export function VoiceOverlayPage() {
  return (
    <div ref={fitWindow} className={cn("flex justify-center", !isMacOS && "pt-3")}>
      <VoiceNoteCard className={cn("max-w-[380px]", !isMacOS && "rounded-xl border")} />
    </div>
  );
}
