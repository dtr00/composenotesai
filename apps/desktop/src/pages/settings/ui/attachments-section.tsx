import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { SETTING_IDS } from "../model/settings-search";
import { FolderPicker, useFolderMissing } from "./folder-picker";
import { SettingsGroup } from "./settings-group";

export function AttachmentsSection() {
  const { mediaFolderId } = useSettings();
  const missing = useFolderMissing(mediaFolderId);

  return (
    <SettingsGroup name="attachments" title="Attachments">
      <Card id={SETTING_IDS.attachmentFolder} size="sm">
        <CardHeader>
          <CardTitle>Attachment folder</CardTitle>
          <CardDescription>
            {missing
              ? "The chosen folder was deleted, so pasted attachments go to the top level."
              : "Images, videos and documents you paste into a note are saved here and show up in the sidebar."}
          </CardDescription>
          <CardAction className="self-center">
            <FolderPicker
              folderId={mediaFolderId}
              label="Attachment folder"
              onChange={(folderId) => updateSettings({ mediaFolderId: folderId })}
            />
          </CardAction>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
