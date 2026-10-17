import { ArrowUp, Loader2, Mic, Square, X } from "lucide-react";
import { RecordingMeterView } from "../../../shared/ui/recording-meter";
import { focusComposer } from "../model/chat-panel";
import {
  cancelVoiceMessage,
  sendVoiceMessage,
  startVoiceMessage,
  stopVoiceMessage,
  useVoiceMessageState,
  voiceMessageMeter,
} from "../model/voice-message";
import { IconActionButton } from "./icon-action-button";

export function RecordButton({ disabled }: { disabled: boolean }) {
  return (
    <IconActionButton label="Record voice message" disabled={disabled} onClick={() => void startVoiceMessage()}>
      <Mic className="size-3.5" />
    </IconActionButton>
  );
}

async function thenFocus(transcribe: () => Promise<void>) {
  await transcribe();
  focusComposer();
}

function cancel() {
  cancelVoiceMessage();
  focusComposer();
}

export function VoiceRecorder() {
  const state = useVoiceMessageState();
  const transcribing = state === "transcribing";
  const recording = state === "recording";
  return (
    <>
      <div className="flex items-center gap-2 px-1 text-[13px]/relaxed">
        {transcribing ? (
          <Loader2 aria-hidden className="size-[13px] shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        )}
        <span role="status">{transcribing ? "Transcribing" : "Recording"}</span>
        {!transcribing && <RecordingMeterView meter={voiceMessageMeter} />}
      </div>
      <div className="flex items-center gap-1">
        <IconActionButton label="Cancel recording" variant="ghost" className="text-muted-foreground" onClick={cancel}>
          <X className="size-3.5" />
        </IconActionButton>
        <div className="ml-auto flex items-center gap-1">
          <IconActionButton
            label="Stop recording"
            hint="Stop and transcribe"
            variant="secondary"
            disabled={!recording}
            onClick={() => void thenFocus(stopVoiceMessage)}
          >
            <Square className="size-3 fill-current" />
          </IconActionButton>
          <IconActionButton
            label="Send voice message"
            disabled={!recording}
            onClick={() => void thenFocus(sendVoiceMessage)}
          >
            <ArrowUp className="size-3.5" />
          </IconActionButton>
        </div>
      </div>
    </>
  );
}
