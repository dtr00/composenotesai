import { getSettings, updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { listModels, type ProviderModels, type RemoteModel } from "../../../shared/api/ai";
import type { ModelRef } from "../../../shared/api/settings";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

interface ModelsState {
  sources: ProviderModels[];
  loading: boolean;
  loaded: boolean;
}

export interface ModelChoice {
  ref: ModelRef;
  model: RemoteModel;
  source: ProviderModels;
}

const store = createStore<ModelsState>({ sources: [], loading: false, loaded: false });
const chatModel = createStore<ModelRef | null>(null);
let request = 0;

export const useModels = () => useStore(store);

export async function refreshModels() {
  const current = ++request;
  updateStore(store, { loading: true });
  try {
    const sources = await listModels();
    if (current === request) updateStore(store, { sources, loading: false, loaded: true });
  } catch (error) {
    if (current === request) updateStore(store, { loading: false, loaded: true });
    showError(error, "ai-models");
  }
}

export const sameModel = (a: ModelRef | null, b: ModelRef | null) =>
  a !== null && b !== null && a.provider === b.provider && a.model === b.model;

export const modelKey = ({ provider, model }: ModelRef) => `${provider}\u0000${model}`;

function choices(sources: ProviderModels[]): ModelChoice[] {
  return sources.flatMap((source) =>
    source.models.map((model) => ({ ref: { provider: source.provider, model: model.id }, model, source })),
  );
}

function resolve(sources: ProviderModels[], chosen: ModelRef | null): ModelChoice | null {
  const all = choices(sources);
  const match = all.find((choice) => sameModel(choice.ref, chosen));
  if (match) return match;
  const offline = chosen && sources.find((source) => source.provider === chosen.provider && source.error);
  if (chosen && offline) {
    return {
      ref: chosen,
      model: { id: chosen.model, name: chosen.model, sizeBytes: null, details: null, vision: false },
      source: offline,
    };
  }
  return all[0] ?? null;
}

export function useDefaultModelChoice(): ModelChoice | null {
  const { sources } = useModels();
  return resolve(sources, useSettings().ai.model);
}

export function useModelChoice(): ModelChoice | null {
  const { sources } = useModels();
  const picked = useStore(chatModel);
  const fallback = useSettings().ai.model;
  return resolve(sources, picked ?? fallback);
}

export const currentModelChoice = () => resolve(store.get().sources, chatModel.get() ?? getSettings().ai.model);

export const chooseChatModel = (ref: ModelRef) => chatModel.set(ref);

export const resetChatModel = () => chatModel.set(null);

export function chooseDefaultModel(ref: ModelRef) {
  if (!sameModel(getSettings().ai.model, ref)) updateAiSettings({ model: ref });
}
