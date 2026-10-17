import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import type { Theme } from "../../../shared/api/settings";
import { Card, CardContent } from "../../../shared/ui/card";
import { ToggleGroup, ToggleGroupItem } from "../../../shared/ui/toggle-group";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";
import { ThemePreview } from "./theme-preview";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function selectTheme([value]: string[]) {
  const theme = THEMES.find((option) => option.value === value)?.value;
  if (theme) updateSettings({ theme });
}

export function ThemeSection() {
  const { theme } = useSettings();

  return (
    <SettingsGroup name="theme" title="Theme">
      <Card id={SETTING_IDS.theme} size="sm">
        <CardContent>
          <ToggleGroup
            variant="outline"
            value={[theme]}
            onValueChange={selectTheme}
            aria-labelledby="theme-heading"
            className="grid w-full grid-cols-3 gap-3"
          >
            {THEMES.map(({ value, label }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="h-auto flex-col items-stretch gap-2 rounded-lg p-2 aria-pressed:bg-foreground/5 dark:aria-pressed:bg-foreground/10"
              >
                <ThemePreview theme={value} />
                <span className="self-start">{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
    </SettingsGroup>
  );
}
