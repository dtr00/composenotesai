import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { SEARCH_ENGINE_OPTIONS } from "../../../features/browser/lib/address";
import type { SearchEngine } from "../../../shared/api/settings";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Separator } from "../../../shared/ui/separator";
import { CACHE_CLEAR_CHOICES, clearBrowserCacheNow } from "../model/browser-cache";
import { SETTING_IDS } from "../model/settings-search";
import { SettingSelect } from "./setting-select";
import { SettingsGroup } from "./settings-group";

export function BrowserSection() {
  const { searchEngine, browserCacheClearHours } = useSettings();

  return (
    <SettingsGroup name="browser" title="Browser">
      <Card size="sm">
        <SettingSelect
          id={SETTING_IDS.searchEngine}
          title="Search engine"
          description="Used for searches from the address bar."
          choices={SEARCH_ENGINE_OPTIONS}
          value={searchEngine}
          onChange={(engine: SearchEngine) => updateSettings({ searchEngine: engine })}
        />
        <Separator className="mx-(--card-spacing) data-horizontal:w-auto" />
        <CardHeader id={SETTING_IDS.browserCache}>
          <CardTitle>Cache</CardTitle>
          <CardDescription>Frees the space used by pages you visited. Sign-ins and site data are kept.</CardDescription>
          <CardAction className="self-center">
            <Button variant="outline" onClick={() => void clearBrowserCacheNow()}>
              Clear cache
            </Button>
          </CardAction>
        </CardHeader>
        <SettingSelect
          id={SETTING_IDS.browserCacheClearing}
          title="Clear cache automatically"
          description="The cache is cleared each time the app starts, and on this schedule while it stays open."
          choices={CACHE_CLEAR_CHOICES}
          value={browserCacheClearHours}
          onChange={(hours) => updateSettings({ browserCacheClearHours: hours })}
        />
      </Card>
    </SettingsGroup>
  );
}
