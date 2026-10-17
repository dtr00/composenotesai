import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { SETTING_IDS } from "../model/settings-search";
import { FolderPicker, useFolderMissing } from "./folder-picker";
import { SettingsGroup } from "./settings-group";

export function VoiceNotesSection() {
  const { voiceFolderId } = useSettings();
  const missing = useFolderMissing(voiceFolderId);

  return (
    <SettingsGroup name="voice-notes" title="Voice notes">
      <Card id={SETTING_IDS.voiceFolder} size="sm">
        <CardHeader>
          <CardTitle>Voice note folder</CardTitle>
          <CardDescription>
            {missing
              ? "The chosen folder was deleted, so voice notes go to the top level."
              : "Notes you record with the recording shortcut are saved here."}
          </CardDescription>
          <CardAction className="self-center">
            <FolderPicker
              folderId={voiceFolderId}
              label="Voice note folder"
              onChange={(folderId) => updateSettings({ voiceFolderId: folderId })}
            />
          </CardAction>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
