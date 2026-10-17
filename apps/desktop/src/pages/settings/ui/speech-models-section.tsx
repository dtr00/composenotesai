import { useSettings } from "../../../entities/settings/model/settings-store";
import type { SpeechModel } from "../../../shared/api/voice";
import { Card, CardFooter } from "../../../shared/ui/card";
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
    <li className="flex items-center gap-3 px-(--card-spacing)">
      <ModelSummary
        name={model.name}
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
    </li>
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
        <ul className="flex flex-col gap-3">
          {models.map((model) => (
            <ModelRow key={model.id} model={model} />
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
