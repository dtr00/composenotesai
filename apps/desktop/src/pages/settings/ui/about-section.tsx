import { Card, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { useAppInfo } from "../model/app-info";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

export function AboutSection() {
  const info = useAppInfo();
  if (!info) return null;

  return (
    <SettingsGroup name="about" title="About">
      <Card id={SETTING_IDS.about} size="sm">
        <CardHeader className="select-text">
          <CardTitle>{info.name}</CardTitle>
          <CardDescription className="tabular-nums">Version {info.version}</CardDescription>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
