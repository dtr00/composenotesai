import { useState } from "react";
import { testProvider } from "../../../shared/api/ai";
import type { ProviderConfig, ProviderKind } from "../../../shared/api/settings";
import { errorMessage } from "../../../shared/lib/error-toast";
import { counted } from "../../../shared/lib/plural";
import { Button } from "../../../shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../../../shared/ui/field";
import { Input } from "../../../shared/ui/input";
import { ToggleGroup, ToggleGroupItem } from "../../../shared/ui/toggle-group";
import { saveProvider } from "../model/ai-settings";

const KINDS: { value: ProviderKind; label: string; url: string; hint: string }[] = [
  {
    value: "ollama",
    label: "Ollama",
    url: "http://localhost:11434",
    hint: "An Ollama server on this computer or another one on your network.",
  },
  {
    value: "openAi",
    label: "OpenAI-compatible",
    url: "http://localhost:8080/v1",
    hint: "llama.cpp, LM Studio, vLLM, LocalAI or any other OpenAI-style server.",
  },
];

type Check =
  { state: "idle" } | { state: "checking" } | { state: "ok"; count: number } | { state: "failed"; message: string };

interface ProviderDialogProps {
  open: boolean;
  provider: ProviderConfig | null;
  onOpenChange: (open: boolean) => void;
}

function draftConfig(id: string | null, kind: ProviderKind, name: string, baseUrl: string, apiKey: string) {
  return {
    id,
    kind,
    name: name.trim(),
    baseUrl: baseUrl.trim().replace(/\/+$/, ""),
    apiKey: apiKey.trim() || null,
    enabled: true,
  };
}

function CheckResult({ check }: { check: Check }) {
  if (check.state === "ok") {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Connected. Found {counted(check.count, "model")}.
      </p>
    );
  }
  if (check.state === "failed") {
    return (
      <p role="alert" className="text-xs text-destructive">
        {check.message}
      </p>
    );
  }
  return null;
}

function ProviderForm({ provider, onDone }: { provider: ProviderConfig | null; onDone: () => void }) {
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? "ollama");
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? "");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const info = KINDS.find((entry) => entry.value === kind) ?? KINDS[0];
  const url = baseUrl.trim() || info.url;
  const config = draftConfig(provider?.id ?? null, kind, name || info.label, url, apiKey);
  const validUrl = /^https?:\/\/[^\s/]+/.test(url);

  const test = async () => {
    setCheck({ state: "checking" });
    try {
      const models = await testProvider({ ...config, id: config.id ?? "draft" });
      setCheck({ state: "ok", count: models.length });
    } catch (error) {
      setCheck({ state: "failed", message: errorMessage(error) });
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!validUrl) return;
        saveProvider({ ...config, enabled: provider?.enabled ?? true });
        onDone();
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel>Type</FieldLabel>
          <ToggleGroup
            variant="outline"
            value={[kind]}
            onValueChange={(value: string[]) => {
              const next = KINDS.find((entry) => entry.value === value[0]);
              if (next) setKind(next.value);
              setCheck({ state: "idle" });
            }}
          >
            {KINDS.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value}>
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{info.hint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="provider-url">Server address</FieldLabel>
          <Input
            id="provider-url"
            value={baseUrl}
            placeholder={info.url}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              setCheck({ state: "idle" });
            }}
            aria-invalid={!validUrl || undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="provider-name">Name</FieldLabel>
          <Input
            id="provider-name"
            value={name}
            placeholder={info.label}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="provider-key">API key</FieldLabel>
          <Input
            id="provider-key"
            type="password"
            value={apiKey}
            placeholder="Optional"
            autoComplete="off"
            onChange={(event) => setApiKey(event.target.value)}
          />
          <FieldDescription>Only needed if your server asks for one. It's stored on this computer.</FieldDescription>
        </Field>
      </FieldGroup>
      <CheckResult check={check} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={!validUrl || check.state === "checking"}
          onClick={() => void test()}
        >
          {check.state === "checking" ? "Checking…" : "Test connection"}
        </Button>
        <Button type="submit" disabled={!validUrl}>
          {provider ? "Save" : "Add provider"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProviderDialog({ open, provider, onOpenChange }: ProviderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provider ? "Edit provider" : "Add a provider"}</DialogTitle>
          <DialogDescription>
            Use models from a server you run yourself, at home or anywhere you can reach.
          </DialogDescription>
        </DialogHeader>
        {open && <ProviderForm key={provider?.id ?? "new"} provider={provider} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
