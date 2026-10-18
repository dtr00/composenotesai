import { checkForUpdateNow, installAvailableUpdate, useUpdate } from "../../../features/updater/model/update-store";
import type { UpdateEvent } from "../../../shared/api/updater";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { useAppInfo } from "../model/app-info";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function installLabel(install: UpdateEvent) {
  if (install.event === "installing") return "Installing";
  if (!install.total) return "Downloading";
  return `Downloading ${Math.round((install.downloaded / install.total) * 100)}%`;
}

function UpdateButton() {
  const { available, checking, install } = useUpdate();

  if (install)
    return (
      <Button variant="outline" className="tabular-nums" disabled>
        {installLabel(install)}
      </Button>
    );
  if (available) return <Button onClick={() => void installAvailableUpdate()}>Update to {available}</Button>;
  return (
    <Button variant="outline" disabled={checking} onClick={() => void checkForUpdateNow()}>
      {checking ? "Checking" : "Check for updates"}
    </Button>
  );
}

export function AboutSection() {
  const info = useAppInfo();
  if (!info) return null;

  return (
    <SettingsGroup name="about" title="About">
      <Card id={SETTING_IDS.about} size="sm">
        <CardHeader className="select-text">
          <CardTitle>{info.name}</CardTitle>
          <CardDescription className="tabular-nums">Version {info.version}</CardDescription>
          <CardAction className="self-center">
            <UpdateButton />
          </CardAction>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
