import { refreshTrash, trashBytes, useTrash } from "../../../entities/note/model/trash-store";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { TRASH_SETTINGS_PATH } from "../../../shared/config/routes";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { counted } from "../../../shared/lib/plural";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Link } from "../../../shared/ui/link";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

export function TrashSummary() {
  const { items } = useTrash();
  useMountEffect(() => void refreshTrash());
  const { trashRetentionDays } = useSettings();
  const count = items?.length ?? 0;
  const bytes = trashBytes(items);
  const retention =
    trashRetentionDays === 0
      ? "Kept until you empty the trash."
      : `Deleted for good after ${counted(trashRetentionDays, "day")}.`;

  return (
    <SettingsGroup
      name="trash-summary"
      title="Trash"
      actions={<span className="text-xs text-muted-foreground tabular-nums">{formatBytes(bytes)}</span>}
    >
      <Card id={SETTING_IDS.trash} size="sm">
        <CardHeader>
          <CardTitle>{count === 0 ? "The trash is empty" : counted(count, "item")}</CardTitle>
          <CardDescription>{retention}</CardDescription>
          <CardAction className="self-center">
            <Link href={`#${TRASH_SETTINGS_PATH}`} variant="outline">
              Manage trash
            </Link>
          </CardAction>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
