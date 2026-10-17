import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Switch } from "../../../shared/ui/switch";
import { SETTING_IDS } from "../model/settings-search";
import { useVoice } from "../model/voice";
import { SettingsGroup } from "./settings-group";
import { ShortcutRow } from "./voice-shortcut-rows";

function HoldToRecordRow({ hold }: { hold: boolean }) {
  return (
    <CardHeader id={SETTING_IDS.holdToRecord}>
      <CardTitle id="hold-to-record-label">Hold to record</CardTitle>
      <CardDescription>Hold the shortcut to record, release to save.</CardDescription>
      <CardAction className="self-center">
        <Switch
          aria-labelledby="hold-to-record-label"
          checked={hold}
          onCheckedChange={(checked) => updateSettings({ holdToRecord: checked })}
        />
      </CardAction>
    </CardHeader>
  );
}

export function RecordingBehaviorSection() {
  const { shortcuts, settingUpShortcut } = useVoice();
  const hold = useSettings().holdToRecord;
  const canCancel = !hold && shortcuts && !shortcuts.needsSetup;

  return (
    <SettingsGroup name="recording-behavior" title="Recording behavior">
      <Card size="sm">
        <HoldToRecordRow hold={hold} />
        {canCancel && (
          <ShortcutRow
            binding="cancel"
            bound={shortcuts.cancel}
            editable={shortcuts.editable}
            busy={settingUpShortcut}
            hold={hold}
          />
        )}
      </Card>
    </SettingsGroup>
  );
}
