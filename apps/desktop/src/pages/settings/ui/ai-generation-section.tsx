import {
  AI_CONTEXT_SIZES,
  AI_TEMPERATURE,
  AI_TOP_P,
  tokenCount,
} from "../../../entities/settings/model/setting-limits";
import { updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import type { AiSettings } from "../../../shared/api/settings";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";
import { Switch } from "../../../shared/ui/switch";
import { SETTING_IDS } from "../model/settings-search";
import { SettingSlider } from "./setting-slider";
import { SettingsGroup } from "./settings-group";

type NumberKey = "maxTokens" | "contextSize" | "threads" | "keepLoadedMinutes";
type SwitchKey = "thinking" | "useGpu";

interface Choice {
  value: number;
  label: string;
}

const CHOICES: Record<NumberKey, Choice[]> = {
  contextSize: AI_CONTEXT_SIZES.map((value) => ({ value, label: tokenCount(value) })),
  maxTokens: [
    { value: 0, label: "No limit" },
    ...[1024, 2048, 4096, 8192, 16384].map((value) => ({ value, label: tokenCount(value) })),
  ],
  threads: [
    { value: 0, label: "Automatic" },
    ...[2, 4, 6, 8, 12, 16].map((value) => ({ value, label: `${value} threads` })),
  ],
  keepLoadedMinutes: [
    { value: 5, label: "5 minutes" },
    { value: 15, label: "15 minutes" },
    { value: 60, label: "1 hour" },
    { value: 0, label: "Until the app closes" },
  ],
};

interface RowProps {
  id: string;
  title: string;
  description: string;
}

function SelectRow({ id, title, description, setting }: RowProps & { setting: NumberKey }) {
  const value = useSettings().ai[setting];
  const choices = CHOICES[setting];
  const items = choices.some((choice) => choice.value === value)
    ? choices
    : [...choices, { value, label: String(value) }];
  const labelId = `${id}-label`;

  return (
    <CardHeader id={id}>
      <CardTitle id={labelId}>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction className="self-center">
        <Select
          items={items}
          value={value}
          onValueChange={(next: number | null) => {
            if (next !== null) updateAiSettings({ [setting]: next } satisfies Partial<AiSettings>);
          }}
        >
          <SelectTrigger aria-labelledby={labelId} className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {items.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardAction>
    </CardHeader>
  );
}

function SwitchRow({ id, title, description, setting }: RowProps & { setting: SwitchKey }) {
  const checked = useSettings().ai[setting];
  const labelId = `${id}-label`;
  return (
    <CardHeader id={id}>
      <CardTitle id={labelId}>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction className="self-center">
        <Switch
          aria-labelledby={labelId}
          checked={checked}
          onCheckedChange={(next) => updateAiSettings({ [setting]: next })}
        />
      </CardAction>
    </CardHeader>
  );
}

const round = (value: number) => Math.round(value * 100) / 100;

export function AiGenerationSection() {
  const { temperature, topP } = useSettings().ai;

  return (
    <>
      <SettingsGroup name="ai-answers" title="Answers">
        <Card size="sm">
          <CardHeader id={SETTING_IDS.aiCreativity}>
            <CardTitle>Creativity</CardTitle>
            <CardDescription>
              Raise these for more varied answers. Lower them for focused, predictable ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SettingSlider
              label="Temperature"
              labelColumnWidth="w-20"
              value={temperature}
              min={AI_TEMPERATURE.min}
              max={AI_TEMPERATURE.max}
              step={0.05}
              unit=""
              onPreview={() => {}}
              onCommit={(value) => updateAiSettings({ temperature: round(value) })}
            />
            <SettingSlider
              label="Top P"
              labelColumnWidth="w-20"
              value={topP}
              min={AI_TOP_P.min}
              max={AI_TOP_P.max}
              step={0.05}
              unit=""
              onPreview={() => {}}
              onCommit={(value) => updateAiSettings({ topP: round(value) })}
            />
          </CardContent>
          <SelectRow
            id={SETTING_IDS.aiResponseLength}
            title="Longest answer"
            description="Stops a reply after this many tokens."
            setting="maxTokens"
          />
          <SwitchRow
            id={SETTING_IDS.aiThinking}
            title="Think before answering"
            description="Models that can reason think first. Slower, but better for hard questions."
            setting="thinking"
          />
        </Card>
      </SettingsGroup>
      <SettingsGroup name="ai-performance" title="Performance">
        <Card size="sm">
          <SelectRow
            id={SETTING_IDS.aiContext}
            title="Context size"
            description="How much text the model can keep in mind, including notes it reads. More uses more memory."
            setting="contextSize"
          />
          <SwitchRow
            id={SETTING_IDS.aiGpu}
            title="Use the graphics card"
            description="Much faster on most computers. Turn off if the model fails to load."
            setting="useGpu"
          />
          <SelectRow
            id={SETTING_IDS.aiThreads}
            title="Processor threads"
            description="Used for the parts of the model that run on the processor."
            setting="threads"
          />
          <SelectRow
            id={SETTING_IDS.aiKeepLoaded}
            title="Keep the model loaded"
            description="Frees memory when you haven't chatted for a while. Loading again takes a few seconds."
            setting="keepLoadedMinutes"
          />
        </Card>
      </SettingsGroup>
    </>
  );
}
