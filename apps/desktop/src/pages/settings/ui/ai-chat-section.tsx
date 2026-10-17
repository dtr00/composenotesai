import { ChevronRight } from "lucide-react";
import { updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import {
  chooseDefaultModel,
  modelKey,
  useDefaultModelChoice,
  useModels,
} from "../../../features/ai-chat/model/models-store";
import type { ModelRef } from "../../../shared/api/settings";
import { AGENT_SETTINGS_PATH, SKILLS_SETTINGS_PATH } from "../../../shared/config/routes";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Link } from "../../../shared/ui/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import { Switch } from "../../../shared/ui/switch";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function ModelRow() {
  const { sources } = useModels();
  const choice = useDefaultModelChoice();
  const options = sources.flatMap((source) =>
    source.models.map((model) => {
      const ref: ModelRef = { provider: source.provider, model: model.id };
      return { value: modelKey(ref), label: `${model.name} (${source.name})`, ref };
    }),
  );
  const empty = options.length === 0;

  return (
    <CardHeader id={SETTING_IDS.aiModel}>
      <CardTitle id="ai-model-label">Default model</CardTitle>
      <CardDescription>
        {empty
          ? "Download a model below or connect a server first."
          : "New chats start with this model. You can switch models in the chat."}
      </CardDescription>
      <CardAction className="self-center">
        <Select
          items={options}
          value={choice ? modelKey(choice.ref) : null}
          disabled={empty}
          onValueChange={(value: string | null) => {
            const picked = options.find((option) => option.value === value);
            if (picked) chooseDefaultModel(picked.ref);
          }}
        >
          <SelectTrigger aria-labelledby="ai-model-label" className="max-w-56 min-w-40">
            <SelectValue placeholder="No models yet" />
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false} className="max-h-80">
            {sources
              .filter((source) => source.models.length > 0)
              .map((source) => (
                <SelectGroup key={source.provider}>
                  <SelectLabel>{source.name}</SelectLabel>
                  {source.models.map((model) => {
                    const value = modelKey({ provider: source.provider, model: model.id });
                    return (
                      <SelectItem key={value} value={value}>
                        {model.name}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
          </SelectContent>
        </Select>
      </CardAction>
    </CardHeader>
  );
}

function EditsRow() {
  const { allowEdits } = useSettings().ai;
  return (
    <CardHeader id={SETTING_IDS.aiEdits}>
      <CardTitle id="ai-edits-label">Let AI edit notes</CardTitle>
      <CardDescription>Create, write and rename notes when you ask. Turn off to only read and search.</CardDescription>
      <CardAction className="self-center">
        <Switch
          aria-labelledby="ai-edits-label"
          checked={allowEdits}
          onCheckedChange={(checked) => updateAiSettings({ allowEdits: checked })}
        />
      </CardAction>
    </CardHeader>
  );
}

function WebSearchRow() {
  const { webSearch } = useSettings().ai;
  return (
    <CardHeader id={SETTING_IDS.aiWebSearch}>
      <CardTitle id="ai-web-search-label">Search the web</CardTitle>
      <CardDescription>
        When you&apos;re online, the AI can search the web, read pages and find openly licensed images. Only search
        words and page addresses leave your computer, never your notes.
      </CardDescription>
      <CardAction className="self-center">
        <Switch
          aria-labelledby="ai-web-search-label"
          checked={webSearch}
          onCheckedChange={(checked) => updateAiSettings({ webSearch: checked })}
        />
      </CardAction>
    </CardHeader>
  );
}

function PageLink({ id, href, title, description }: { id: string; href: string; title: string; description: string }) {
  return (
    <CardHeader id={id}>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction className="self-center">
        <Link href={`#${href}`} variant="outline" aria-label={title}>
          Open
          <ChevronRight data-icon="inline-end" />
        </Link>
      </CardAction>
    </CardHeader>
  );
}

export function AiChatSection() {
  const custom = useSettings().ai.instructions !== null;

  return (
    <SettingsGroup name="ai-chat" title="Chat">
      <Card size="sm">
        <ModelRow />
        <EditsRow />
        <WebSearchRow />
        <PageLink
          id={SETTING_IDS.aiSkills}
          href={SKILLS_SETTINGS_PATH}
          title="Skills"
          description="Install instructions the AI follows for jobs like meeting notes or study guides."
        />
        <PageLink
          id={SETTING_IDS.aiAgent}
          href={AGENT_SETTINGS_PATH}
          title="Agent instructions"
          description={custom ? "Using your own instructions." : "The main file that describes what Compose AI does."}
        />
      </Card>
    </SettingsGroup>
  );
}
