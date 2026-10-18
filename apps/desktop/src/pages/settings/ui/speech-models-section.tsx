import { useSettings } from "../../../entities/settings/model/settings-store";
import type { SpeechModel } from "../../../shared/api/voice";
import { Card, CardFooter } from "../../../shared/ui/card";
import { Separator } from "../../../shared/ui/separator";
import { SETTING_IDS } from "../model/settings-search";
import { cancelDownload, chooseModel, downloadModel, removeModel, useVoice } from "../model/voice";
import { ExternalLink } from "./external-link";
import { ModelSummary } from "./model-summary";
import { SettingsGroup } from "./settings-group";

const WHISPER_URL = "https://github.com/openai/whisper";
const MODEL_FILES_URL = "https://huggingface.co/ggerganov/whisper.cpp";

function ModelRow({ model }: { model: SpeechModel }) {
  const { voiceModel } = useSettings();
  const progress = useVoice().downloads[model.id];

  return (
    <div className="flex items-center gap-3 px-(--card-spacing)">
      <ModelSummary
        name={model.name}
        recommended={model.id === "small"}
        description={model.description}
        sizeBytes={model.sizeBytes}
        installed={model.installed}
        isDefault={voiceModel === model.id}
        progress={progress}
        onDownload={() => void downloadModel(model.id)}
        onCancel={() => cancelDownload(model.id)}
        onSetDefault={() => chooseModel(model.id)}
        onDelete={() => void removeModel(model.id)}
      />
    </div>
  );
}

export function SpeechModelsSection() {
  const { models } = useVoice();

  return (
    <SettingsGroup name="speech-model" title="Speech model">
      <Card id={SETTING_IDS.speechModel} size="sm" className="pb-0">
        <p className="px-(--card-spacing) text-xs text-muted-foreground">
          Voice notes are transcribed on this device. A model downloads once and works offline.
        </p>
        <ul className="flex flex-col gap-(--card-spacing)">
          {models.map((model, i) => (
            <li key={model.id} className="flex flex-col gap-(--card-spacing)">
              {i > 0 && <Separator className="mx-(--card-spacing) data-horizontal:w-auto" />}
              <ModelRow model={model} />
            </li>
          ))}
        </ul>
        <CardFooter className="block border-t bg-muted/50 py-(--card-spacing) text-muted-foreground/70">
          These are OpenAI&apos;s <ExternalLink href={WHISPER_URL}>Whisper</ExternalLink> models (MIT license),
          downloaded from <ExternalLink href={MODEL_FILES_URL}>Hugging Face</ExternalLink>.
        </CardFooter>
      </Card>
    </SettingsGroup>
  );
}
