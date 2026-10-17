import { cn } from "cn";
import type { ReactNode } from "react";
import type { VoiceStatus } from "../../../shared/api/voice";
import { parseHotkey } from "../../../shared/lib/hotkeys";
import { RecordingMeterView } from "../../../shared/ui/recording-meter";
import { Shortcut } from "../../../shared/ui/shortcut";
import { useVoiceNote, voiceNoteMeter } from "../model/voice-note";
import { StatusIcon } from "./status-icon";

function headline(status: VoiceStatus) {
  switch (status.state) {
    case "recording":
      return "Recording";
    case "transcribing":
      return "Transcribing";
    case "saved":
      return `Saved “${status.title}”`;
    case "cancelled":
      return "Voice note cancelled";
    case "failed":
      return "Couldn't save the voice note";
  }
}

function Hint({ hotkey, action }: { hotkey: string | null; action: string }) {
  const parsed = hotkey ? parseHotkey(hotkey) : null;
  if (!parsed) return null;
  return (
    <span className="flex items-center gap-1.5">
      <Shortcut hotkey={parsed} />
      {action}
    </span>
  );
}

function markOverflow(text: HTMLElement | null) {
  const line = text?.parentElement;
  if (!text || !line) return;
  const observer = new ResizeObserver(() =>
    line.toggleAttribute("data-overflowing", text.offsetWidth > line.clientWidth),
  );
  observer.observe(text);
  observer.observe(line);
  return () => observer.disconnect();
}

function LiveTranscript({ preview }: { preview: string }) {
  return (
    <div className="flex justify-end overflow-hidden text-[13px] leading-[18px] whitespace-nowrap data-overflowing:mask-[linear-gradient(to_right,transparent,black_2rem)]">
      <span ref={markOverflow} className={cn("min-w-full shrink-0", !preview && "text-muted-foreground")}>
        {preview || "Listening…"}
      </span>
    </div>
  );
}

function Transcript({ status, preview }: { status: VoiceStatus; preview: string }) {
  if (status.state === "recording") return <LiveTranscript preview={preview} />;
  if (status.state !== "failed") return null;
  return <p className="line-clamp-3 text-[13px] leading-[18px] text-destructive">{status.message}</p>;
}

export function VoiceNoteCard({ className, action }: { className?: string; action?: ReactNode }) {
  const { status, preview } = useVoiceNote();
  if (!status) return null;
  const recording = status.state === "recording";

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 overflow-hidden bg-popover p-3.5 font-sans text-popover-foreground select-none",
        className,
      )}
    >
      <header className="flex h-5 items-center gap-2 text-xs font-medium">
        <StatusIcon state={status.state} />
        <span role="status" className="truncate">
          {headline(status)}
        </span>
        {recording && <RecordingMeterView meter={voiceNoteMeter} />}
        {action && <span className="-my-1 ml-auto">{action}</span>}
      </header>
      <Transcript status={status} preview={preview} />
      {recording && (
        <footer className="flex h-5 items-center gap-4 text-xs text-muted-foreground">
          <Hint hotkey={status.record} action={status.hold ? "Release to save" : "Save"} />
          <Hint hotkey={status.cancel} action="Cancel" />
        </footer>
      )}
    </div>
  );
}
