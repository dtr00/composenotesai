import { useState } from "react";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { chooseDefaultModel, sameModel } from "../../../features/ai-chat/model/models-store";
import { LOCAL_PROVIDER } from "../../../shared/api/settings";
import type { LocalModel } from "../../../shared/api/ai";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Input } from "../../../shared/ui/input";
import { Separator } from "../../../shared/ui/separator";
import {
  cancelAiEngineInstall,
  cancelAiModelDownload,
  cancelAiVisionDownload,
  downloadAiModel,
  downloadAiModelFromUrl,
  downloadAiVision,
  ENGINE_DOWNLOAD,
  installAiEngine,
  removeAiEngine,
  removeAiModel,
  removeAiVision,
  unloadAiModel,
  URL_DOWNLOAD,
  useAiSettings,
  visionDownload,
} from "../model/ai-settings";
import { SETTING_IDS } from "../model/settings-search";
import { DownloadStatus } from "./download-status";
import { ExternalLink } from "./external-link";
import { ModelSummary } from "./model-summary";
import { SettingsGroup } from "./settings-group";

const LLAMA_CPP_URL = "https://github.com/ggml-org/llama.cpp";
const HUGGING_FACE_URL = "https://huggingface.co/models?library=gguf";

function EngineRow() {
  const { engine, downloads, models } = useAiSettings();
  const progress = downloads[ENGINE_DOWNLOAD];
  if (!engine) return null;
  const loaded = engine.loadedModel && models.find((model) => model.id === engine.loadedModel);

  let status = "Runs models on this computer. Downloads once, works offline.";
  if (!engine.available)
    status = "The built-in engine isn't available for this computer yet. Connect Ollama or another server below.";
  else if (engine.installed && loaded) status = `${loaded.name} is loaded and ready.`;
  else if (engine.installed) status = `Installed, ${formatBytes(engine.installedBytes)}. Loads a model when you chat.`;

  return (
    <CardHeader id={SETTING_IDS.aiEngine}>
      <CardTitle>AI engine</CardTitle>
      <CardDescription>{status}</CardDescription>
      <CardAction className="flex items-center gap-2 self-center">
        {progress ? (
          <DownloadStatus label="Installing the AI engine" progress={progress} onCancel={cancelAiEngineInstall} />
        ) : !engine.installed ? (
          engine.available && (
            <Button variant="outline" size="sm" onClick={() => void installAiEngine()}>
              Install ({formatBytes(engine.downloadBytes)})
            </Button>
          )
        ) : (
          <>
            {loaded && (
              <Button variant="outline" size="sm" onClick={() => void unloadAiModel()}>
                Unload
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void removeAiEngine()}>
              Remove
            </Button>
          </>
        )}
      </CardAction>
    </CardHeader>
  );
}

function VisionRow({ model, sizeBytes, installed }: { model: LocalModel; sizeBytes: number; installed: boolean }) {
  const progress = useAiSettings().downloads[visionDownload(model.id)];
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">
        {installed ? "Can see drawings, including handwriting and pictures." : "Add vision to let it see drawings."}
      </span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(sizeBytes)}</span>
      <div className="flex shrink-0 items-center gap-2">
        {progress ? (
          <DownloadStatus
            label={`Downloading vision for ${model.name}`}
            progress={progress}
            onCancel={() => cancelAiVisionDownload(model.id)}
          />
        ) : installed ? (
          <Button variant="ghost" size="sm" onClick={() => void removeAiVision(model.id)}>
            Remove vision
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void downloadAiVision(model.id)}>
            Add vision
          </Button>
        )}
      </div>
    </div>
  );
}

function ModelRow({ model }: { model: LocalModel }) {
  const progress = useAiSettings().downloads[model.id];
  const chosen = useSettings().ai.model;
  const ref = { provider: LOCAL_PROVIDER, model: model.id };
  return (
    <div className="flex flex-col gap-2 px-(--card-spacing)">
      <div className="flex items-center gap-3">
        <ModelSummary
          name={model.name}
          description={model.description ?? "Added from a link."}
          sizeBytes={model.sizeBytes}
          installed={model.installed}
          isDefault={sameModel(chosen, ref)}
          progress={progress}
          onDownload={() => void downloadAiModel(model.id)}
          onCancel={() => cancelAiModelDownload(model.id)}
          onSetDefault={() => chooseDefaultModel(ref)}
          onDelete={() => void removeAiModel(model.id)}
        />
      </div>
      {model.installed && model.vision && <VisionRow model={model} {...model.vision} />}
    </div>
  );
}

function AddFromLink() {
  const [url, setUrl] = useState("");
  const progress = useAiSettings().downloads[URL_DOWNLOAD];
  const download = async () => {
    if (await downloadAiModelFromUrl(url)) setUrl("");
  };

  return (
    <form
      className="flex items-center gap-2 px-(--card-spacing)"
      onSubmit={(event) => {
        event.preventDefault();
        void download();
      }}
    >
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Link to a .gguf file, for example from Hugging Face"
        aria-label="Model link"
        disabled={progress !== undefined}
        className="h-7 min-w-0 flex-1 text-xs"
      />
      {progress ? (
        <DownloadStatus
          label="Downloading the model"
          progress={progress}
          onCancel={() => cancelAiModelDownload(URL_DOWNLOAD)}
        />
      ) : (
        <Button type="submit" variant="outline" size="sm" disabled={!url.trim()}>
          Add model
        </Button>
      )}
    </form>
  );
}

export function AiDeviceSection() {
  const { models } = useAiSettings();

  return (
    <SettingsGroup name="ai-device" title="On this device">
      <Card size="sm">
        <EngineRow />
      </Card>
      <Card id={SETTING_IDS.aiModels} size="sm" className="pb-0">
        <p className="px-(--card-spacing) text-xs text-muted-foreground">
          Models run privately on this computer. Larger models write better but need more memory.
        </p>
        <ul className="flex flex-col gap-(--card-spacing)">
          {models.map((model, i) => (
            <li key={model.id} className="flex flex-col gap-(--card-spacing)">
              {i > 0 && <Separator className="mx-(--card-spacing) data-horizontal:w-auto" />}
              <ModelRow model={model} />
            </li>
          ))}
        </ul>
        <AddFromLink />
        <CardFooter className="block border-t bg-muted/50 py-(--card-spacing) text-muted-foreground/70">
          Models run with <ExternalLink href={LLAMA_CPP_URL}>llama.cpp</ExternalLink> (MIT license). Find more models on{" "}
          <ExternalLink href={HUGGING_FACE_URL}>Hugging Face</ExternalLink>.
        </CardFooter>
      </Card>
    </SettingsGroup>
  );
}
