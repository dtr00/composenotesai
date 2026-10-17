import { Fragment } from "react";
import { previewLook, updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import type { Settings } from "../../../shared/api/settings";
import { currentColor } from "../../../entities/settings/lib/surface-colors";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { ColorPicker, type ColorPreset } from "../../../shared/ui/color-picker";
import { Separator } from "../../../shared/ui/separator";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

const DEFAULT_ACCENT = "#0069a8";

const ACCENT_PRESETS: ColorPreset[] = [
  { label: "Blue", value: DEFAULT_ACCENT },
  { label: "Violet", value: "#7f22fe" },
  { label: "Pink", value: "#e60076" },
  { label: "Red", value: "#e7000b" },
  { label: "Orange", value: "#f54900" },
  { label: "Amber", value: "#e17100" },
  { label: "Green", value: "#00a63e" },
  { label: "Teal", value: "#009689" },
];

type ColorKey = "accentColor" | "sidebarColor" | "panelColor";

interface ColorOption {
  key: ColorKey;
  id: string;
  title: string;
  description: string;
  fallback: () => string;
  presets?: ColorPreset[];
}

const OPTIONS: ColorOption[] = [
  {
    key: "accentColor",
    id: SETTING_IDS.accentColor,
    title: "Accent color",
    description: "Used for highlights, selections and charts.",
    fallback: () => DEFAULT_ACCENT,
    presets: ACCENT_PRESETS,
  },
  {
    key: "sidebarColor",
    id: SETTING_IDS.sidebarColor,
    title: "Sidebar color",
    description: "Used for the sidebar and title bar.",
    fallback: () => currentColor("--sidebar"),
  },
  {
    key: "panelColor",
    id: SETTING_IDS.panelColor,
    title: "Panel color",
    description: "Used for the main panel.",
    fallback: () => currentColor("--background"),
  },
];

function ColorRow({ option, value }: { option: ColorOption; value: Settings[ColorKey] }) {
  const change = (hex: string | null) => updateSettings({ [option.key]: hex });

  return (
    <CardHeader id={option.id}>
      <CardTitle>{option.title}</CardTitle>
      <CardDescription>{option.description}</CardDescription>
      <CardAction className="flex items-center gap-1 self-center">
        {value !== null && (
          <Button variant="ghost" onClick={() => change(null)}>
            Reset
          </Button>
        )}
        <ColorPicker
          aria-label={option.title}
          value={value ?? option.fallback()}
          onValueChange={(hex) => previewLook({ [option.key]: hex })}
          onValueCommit={change}
          presets={option.presets}
        />
      </CardAction>
    </CardHeader>
  );
}

export function ColorsSection() {
  const settings = useSettings();

  return (
    <SettingsGroup name="colors" title="Colors">
      <Card size="sm">
        {OPTIONS.map((option, i) => (
          <Fragment key={option.key}>
            {i > 0 && <Separator className="mx-(--card-spacing) data-horizontal:w-auto" />}
            <ColorRow option={option} value={settings[option.key]} />
          </Fragment>
        ))}
      </Card>
    </SettingsGroup>
  );
}
