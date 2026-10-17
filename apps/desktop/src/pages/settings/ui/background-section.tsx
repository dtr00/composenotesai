import { ImageIcon, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import { BACKGROUND_BLUR_PX, BACKGROUND_OPACITY } from "../../../entities/settings/model/setting-limits";
import { previewSettings, updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import {
  choosePanelBackground,
  removePanelBackground,
  usePanelBackground,
} from "../../../features/panel-background/model/background-store";
import type { BackgroundStyle } from "../../../shared/api/settings";
import { mediaAccept } from "../../../shared/config/media-types";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { ToggleGroup, ToggleGroupItem } from "../../../shared/ui/toggle-group";
import { DitherIcon } from "./dither-icon";
import { SETTING_IDS } from "../model/settings-search";
import { PositionDialog } from "./position-dialog";
import { SettingsGroup } from "./settings-group";
import { SettingSlider } from "./setting-slider";

const STYLES: { value: BackgroundStyle; label: string; icon: LucideIcon }[] = [
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "dither", label: "Dither", icon: DitherIcon },
];

function selectStyle([value]: string[]) {
  const backgroundStyle = STYLES.find((style) => style.value === value)?.value;
  if (backgroundStyle) updateSettings({ backgroundStyle });
}

function StylePicker({ value }: { value: BackgroundStyle }) {
  return (
    <div id={SETTING_IDS.backgroundStyle} className="flex items-center gap-3">
      <span id="background-style-label" className="w-16 shrink-0 text-xs">
        Style
      </span>
      <ToggleGroup
        variant="outline"
        value={[value]}
        onValueChange={selectStyle}
        aria-labelledby="background-style-label"
      >
        {STYLES.map((style) => (
          <ToggleGroupItem
            key={style.value}
            value={style.value}
            className="aria-pressed:bg-foreground/5 dark:aria-pressed:bg-foreground/10"
          >
            <style.icon data-icon="inline-start" />
            {style.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function BackgroundSection() {
  const { backgroundBlur, backgroundOpacity, backgroundStyle } = useSettings();
  const { url, image } = usePanelBackground();
  const input = useRef<HTMLInputElement>(null);

  return (
    <SettingsGroup name="background" title="Background">
      <Card id={SETTING_IDS.backgroundImage} size="sm">
        <CardHeader>
          <CardTitle>Background image</CardTitle>
          <CardDescription>Shows behind the main panel.</CardDescription>
          <CardAction className="flex items-center gap-1 self-center">
            <input
              ref={input}
              type="file"
              accept={mediaAccept("image")}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void choosePanelBackground(file);
              }}
            />
            {url && (
              <Button variant="ghost" onClick={() => void removePanelBackground()}>
                Remove
              </Button>
            )}
            {url && image && <PositionDialog url={url} image={image} />}
            <Button variant="outline" onClick={() => input.current?.click()}>
              {url ? "Change image" : "Choose image"}
            </Button>
          </CardAction>
        </CardHeader>
        {url && (
          <CardContent className="flex flex-col gap-4">
            <StylePicker value={backgroundStyle} />
            <SettingSlider
              id={SETTING_IDS.backgroundBlur}
              label="Blur"
              value={backgroundBlur}
              min={BACKGROUND_BLUR_PX.min}
              max={BACKGROUND_BLUR_PX.max}
              step={1}
              unit="px"
              onPreview={(blur) => previewSettings({ backgroundBlur: blur })}
              onCommit={(blur) => updateSettings({ backgroundBlur: blur })}
            />
            <SettingSlider
              id={SETTING_IDS.backgroundOpacity}
              label="Opacity"
              value={Math.round(backgroundOpacity * 100)}
              min={Math.round(BACKGROUND_OPACITY.min * 100)}
              max={Math.round(BACKGROUND_OPACITY.max * 100)}
              step={1}
              unit="%"
              onPreview={(percent) => previewSettings({ backgroundOpacity: percent / 100 })}
              onCommit={(percent) => updateSettings({ backgroundOpacity: percent / 100 })}
            />
          </CardContent>
        )}
      </Card>
    </SettingsGroup>
  );
}
