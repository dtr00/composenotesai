import { Card } from "../../../shared/ui/card";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { followVoiceSettings } from "../model/voice";
import { MicrophoneRow } from "./microphone-row";
import { MicrophoneTestRow } from "./microphone-test-row";
import { RecordingBehaviorSection } from "./recording-behavior-section";
import { SettingsGroup } from "./settings-group";
import { SpeechModelsSection } from "./speech-models-section";
import { VoiceNotesSection } from "./voice-notes-section";
import { VoiceShortcutRows } from "./voice-shortcut-rows";

export function VoiceSection() {
  useMountEffect(followVoiceSettings);
  return (
    <>
      <SettingsGroup name="recording" title="Recording">
        <Card size="sm">
          <MicrophoneRow />
          <VoiceShortcutRows />
          <MicrophoneTestRow />
        </Card>
      </SettingsGroup>
      <RecordingBehaviorSection />
      <VoiceNotesSection />
      <SpeechModelsSection />
    </>
  );
}
