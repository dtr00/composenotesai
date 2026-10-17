import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { SEARCH_ENGINE_OPTIONS } from "../../../features/browser/lib/address";
import type { SearchEngine } from "../../../shared/api/settings";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";
import { CACHE_CLEAR_CHOICES, clearBrowserCacheNow } from "../model/browser-cache";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function selectEngine(value: SearchEngine | null) {
  if (value) updateSettings({ searchEngine: value });
}

function selectCacheClearing(hours: number | null) {
  if (hours !== null) updateSettings({ browserCacheClearHours: hours });
}

export function BrowserSection() {
  const { searchEngine, browserCacheClearHours } = useSettings();

  return (
    <SettingsGroup name="browser" title="Browser">
      <Card id={SETTING_IDS.searchEngine} size="sm">
        <CardHeader>
          <CardTitle id="search-engine-label">Search engine</CardTitle>
          <CardDescription>Used for searches from the address bar.</CardDescription>
          <CardAction className="self-center">
            <Select items={SEARCH_ENGINE_OPTIONS} value={searchEngine} onValueChange={selectEngine}>
              <SelectTrigger aria-labelledby="search-engine-label" className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SEARCH_ENGINE_OPTIONS.map((engine) => (
                  <SelectItem key={engine.value} value={engine.value}>
                    {engine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
      </Card>
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
      <Card id={SETTING_IDS.browserCacheClearing} size="sm">
        <CardHeader>
          <CardTitle id="cache-clearing-label">Clear cache automatically</CardTitle>
          <CardDescription>
            The cache is cleared each time the app starts, and on this schedule while it stays open.
          </CardDescription>
          <CardAction className="self-center">
            <Select items={CACHE_CLEAR_CHOICES} value={browserCacheClearHours} onValueChange={selectCacheClearing}>
              <SelectTrigger aria-labelledby="cache-clearing-label" className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {CACHE_CLEAR_CHOICES.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
      </Card>
    </SettingsGroup>
  );
}
