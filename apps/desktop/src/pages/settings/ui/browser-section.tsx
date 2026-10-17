import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { SEARCH_ENGINE_OPTIONS } from "../../../features/browser/lib/address";
import type { SearchEngine } from "../../../shared/api/settings";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";
import { CACHE_CLEAR_CHOICES, clearBrowserCacheNow } from "../model/browser-cache";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

interface ChoiceCardProps<T extends string | number> {
  id: string;
  title: string;
  description: string;
  choices: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ChoiceCard<T extends string | number>({
  id,
  title,
  description,
  choices,
  value,
  onChange,
}: ChoiceCardProps<T>) {
  const labelId = `${id}-label`;

  return (
    <Card id={id} size="sm">
      <CardHeader>
        <CardTitle id={labelId}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="self-center">
          <Select items={choices} value={value} onValueChange={(next: T | null) => next !== null && onChange(next)}>
            <SelectTrigger aria-labelledby={labelId} className="min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

export function BrowserSection() {
  const { searchEngine, browserCacheClearHours } = useSettings();

  return (
    <SettingsGroup name="browser" title="Browser">
      <ChoiceCard
        id={SETTING_IDS.searchEngine}
        title="Search engine"
        description="Used for searches from the address bar."
        choices={SEARCH_ENGINE_OPTIONS}
        value={searchEngine}
        onChange={(engine: SearchEngine) => updateSettings({ searchEngine: engine })}
      />
      <Card id={SETTING_IDS.browserCache} size="sm">
        <CardHeader>
          <CardTitle>Cache</CardTitle>
          <CardDescription>Frees the space used by pages you visited. Sign-ins and site data are kept.</CardDescription>
          <CardAction className="self-center">
            <Button variant="outline" onClick={() => void clearBrowserCacheNow()}>
              Clear cache
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
      <ChoiceCard
        id={SETTING_IDS.browserCacheClearing}
        title="Clear cache automatically"
        description="The cache is cleared each time the app starts, and on this schedule while it stays open."
        choices={CACHE_CLEAR_CHOICES}
        value={browserCacheClearHours}
        onChange={(hours) => updateSettings({ browserCacheClearHours: hours })}
      />
    </SettingsGroup>
  );
}
