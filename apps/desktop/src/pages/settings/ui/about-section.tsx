import { toast } from "sonner";
import { checkForUpdate, installAvailableUpdate, useUpdate } from "../../../features/updater/model/update-store";
import { reportAction } from "../../../shared/lib/error-toast";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { useAppInfo } from "../model/app-info";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

async function checkNow() {
  if ((await reportAction(checkForUpdate())) === null) toast.success("You have the latest version");
}

function UpdateButton() {
  const { available, checking, updating, downloaded, total, installing } = useUpdate();

  if (updating) {
    const percent = total ? Math.round((downloaded / total) * 100) : null;
    return (
      <Button variant="outline" className="tabular-nums" disabled>
        {installing ? "Installing" : percent === null ? "Downloading" : `Downloading ${percent}%`}
      </Button>
    );
  }
  if (available) return <Button onClick={() => void installAvailableUpdate()}>Update to {available}</Button>;
  return (
    <Button variant="outline" disabled={checking} onClick={() => void checkNow()}>
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
