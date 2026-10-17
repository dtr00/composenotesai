import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { SEARCH_ENGINE_OPTIONS } from "../../../features/browser/lib/address";
import type { SearchEngine } from "../../../shared/api/settings";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function selectEngine(value: SearchEngine | null) {
  if (value) updateSettings({ searchEngine: value });
}

export function BrowserSection() {
  const { searchEngine } = useSettings();

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
    </SettingsGroup>
  );
}
