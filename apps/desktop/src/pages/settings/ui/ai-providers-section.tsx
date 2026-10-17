import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useModels } from "../../../features/ai-chat/model/models-store";
import type { ProviderModels } from "../../../shared/api/ai";
import type { ProviderConfig } from "../../../shared/api/settings";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { counted } from "../../../shared/lib/plural";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Input } from "../../../shared/ui/input";
import { Switch } from "../../../shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import {
  cancelPull,
  pullModel,
  removeOllamaModel,
  removeProvider,
  setProviderEnabled,
  useAiSettings,
} from "../model/ai-settings";
import { SETTING_IDS } from "../model/settings-search";
import { DownloadStatus } from "./download-status";
import { ProviderDialog } from "./provider-dialog";
import { SettingsGroup } from "./settings-group";

const KIND_LABELS: Record<ProviderConfig["kind"], string> = { ollama: "Ollama", openAi: "OpenAI-compatible" };

function status(provider: ProviderConfig, source: ProviderModels | undefined, loading: boolean) {
  if (!provider.enabled) return "Turned off.";
  if (!source) return loading ? "Connecting…" : "Not checked yet.";
  if (source.error) return source.error;
  return `Connected. ${counted(source.models.length, "model")}.`;
}

function OllamaModels({ provider, source }: { provider: ProviderConfig; source: ProviderModels }) {
  const [name, setName] = useState("");
  const pulls = Object.entries(useAiSettings().pulls[provider.id] ?? {});

  return (
    <div className="flex flex-col gap-2 border-t px-(--card-spacing) pt-3">
      <ul className="flex flex-col gap-2">
        {source.models.map((model) => (
          <li key={model.id} className="flex items-center gap-3 text-xs">
            <span className="min-w-0 truncate font-medium">{model.name}</span>
            {model.details && <span className="truncate text-muted-foreground">{model.details}</span>}
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {model.sizeBytes ? formatBytes(model.sizeBytes) : ""}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${model.name}`}
                    onClick={() => void removeOllamaModel(provider.id, model.id)}
                  />
                }
              >
                <Trash2 />
              </TooltipTrigger>
              <TooltipContent>Delete from {provider.name}</TooltipContent>
            </Tooltip>
          </li>
        ))}
        {pulls.map(([model, progress]) => (
          <li key={model} className="flex items-center gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium">{model}</span>
            <DownloadStatus
              label={`Downloading ${model}`}
              progress={progress}
              onCancel={() => cancelPull(provider.id, model)}
            />
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void pullModel(provider.id, name);
          setName("");
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Model name, for example qwen3:4b"
          aria-label={`Model to download to ${provider.name}`}
          className="h-7 min-w-0 flex-1 text-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
          Download
        </Button>
      </form>
    </div>
  );
}

function ProviderCard({ provider, onEdit }: { provider: ProviderConfig; onEdit: () => void }) {
  const { sources, loading } = useModels();
  const source = sources.find((entry) => entry.provider === provider.id);
  const manage = provider.kind === "ollama" && provider.enabled && source && !source.error;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="truncate">{provider.name}</span>
          <Badge variant="outline">{KIND_LABELS[provider.kind]}</Badge>
        </CardTitle>
        <CardDescription className="flex flex-col">
          <span className="truncate select-text">{provider.baseUrl}</span>
          <span className={source?.error && provider.enabled ? "text-destructive" : undefined}>
            {status(provider, source, loading)}
          </span>
        </CardDescription>
        <CardAction className="flex items-center gap-1 self-center">
          <Switch
            aria-label={`Use ${provider.name}`}
            checked={provider.enabled}
            onCheckedChange={(checked) => setProviderEnabled(provider.id, checked)}
          />
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${provider.name}`}
                  onClick={() => removeProvider(provider.id)}
                />
              }
            >
              <Trash2 />
            </TooltipTrigger>
            <TooltipContent>Remove provider</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      {manage && <OllamaModels provider={provider} source={source} />}
    </Card>
  );
}

export function AiProvidersSection() {
  const { providers } = useSettings().ai;
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (provider: ProviderConfig | null) => {
    setEditing(provider);
    setOpen(true);
  };

  return (
    <SettingsGroup
      name="ai-providers"
      title="Your servers"
      actions={
        <Button variant="ghost" size="sm" onClick={() => edit(null)}>
          <Plus data-icon="inline-start" />
          Add provider
        </Button>
      }
    >
      {providers.length === 0 ? (
        <Card id={SETTING_IDS.aiProviders} size="sm">
          <CardHeader>
            <CardTitle>No servers yet</CardTitle>
            <CardDescription>
              Connect Ollama, LM Studio, a llama.cpp server or any OpenAI-compatible server you host, on this computer
              or somewhere else.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div id={SETTING_IDS.aiProviders} className="flex flex-col gap-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} onEdit={() => edit(provider)} />
          ))}
        </div>
      )}
      <ProviderDialog open={open} provider={editing} onOpenChange={setOpen} />
    </SettingsGroup>
  );
}
