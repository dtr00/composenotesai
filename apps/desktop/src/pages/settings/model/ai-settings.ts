import { getSettings, updateAiSettings } from "../../../entities/settings/model/settings-store";
import { refreshModels, sameModel } from "../../../features/ai-chat/model/models-store";
import {
  cancelEngineInstall,
  cancelModelDownload,
  cancelOllamaPull,
  cancelVisionDownload,
  deleteLocalModel,
  deleteOllamaModel,
  deleteVision,
  downloadLocalModel,
  downloadModelFromUrl,
  downloadVision,
  installEngine,
  listLocalModels,
  loadEngine,
  pullOllamaModel,
  uninstallEngine,
  unloadModel,
  type EngineInfo,
  type LocalModel,
} from "../../../shared/api/ai";
import type { DownloadProgress } from "../../../shared/api/download";
import { LOCAL_PROVIDER, type ModelRef, type ProviderConfig } from "../../../shared/api/settings";
import { trackDownload, withEntry } from "../../../shared/lib/download-progress";
import { reportAction, reportSucceeded } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

export const ENGINE_DOWNLOAD = "engine";
export const URL_DOWNLOAD = "url";

interface AiSettingsState {
  engine: EngineInfo | null;
  models: LocalModel[];
  downloads: Record<string, DownloadProgress>;
  pulls: Record<string, Record<string, DownloadProgress>>;
}

const store = createStore<AiSettingsState>({ engine: null, models: [], downloads: {}, pulls: {} });

export const useAiSettings = () => useStore(store);

async function refreshLocal() {
  const [engine, models] = await Promise.all([loadEngine(), listLocalModels()]);
  updateStore(store, { engine, models });
}

export function refreshAiSettings() {
  void reportAction(refreshLocal());
  void refreshModels();
}

const progressOf = (id: string) => (progress: DownloadProgress | null) =>
  updateStore(store, { downloads: withEntry(store.get().downloads, id, progress) });

const pullProgressOf = (provider: string, model: string) => (progress: DownloadProgress | null) => {
  const { pulls } = store.get();
  const models = withEntry(pulls[provider] ?? {}, model, progress);
  updateStore(store, { pulls: withEntry(pulls, provider, Object.keys(models).length > 0 ? models : null) });
};

async function ensureEngine(): Promise<boolean> {
  if (store.get().engine?.installed) return true;
  try {
    return await trackDownload(progressOf(ENGINE_DOWNLOAD), installEngine);
  } finally {
    await refreshLocal();
  }
}

export const installAiEngine = () => reportAction(ensureEngine());

export const cancelAiEngineInstall = () => void cancelEngineInstall();

export async function removeAiEngine() {
  await reportAction(uninstallEngine());
  await reportAction(refreshLocal());
}

export async function unloadAiModel() {
  await reportAction(unloadModel());
  await reportAction(refreshLocal());
}

function chooseIfUnset(model: string) {
  if (!getSettings().ai.model) updateAiSettings({ model: { provider: LOCAL_PROVIDER, model } });
}

function clearDefaultIf(ref: ModelRef) {
  if (sameModel(getSettings().ai.model, ref)) updateAiSettings({ model: null });
}

async function afterDownload(id: string | null) {
  await refreshLocal();
  await refreshModels();
  if (id) chooseIfUnset(id);
}

export const downloadAiModel = (id: string) =>
  reportAction(
    trackDownload(progressOf(id), async (onProgress) => {
      if (!(await ensureEngine())) return;
      const finished = await downloadLocalModel(id, onProgress);
      await afterDownload(finished ? id : null);
    }),
  );

export function cancelAiModelDownload(id: string) {
  if (store.get().downloads[ENGINE_DOWNLOAD]) void cancelEngineInstall();
  else void cancelModelDownload(id);
}

export async function downloadAiModelFromUrl(url: string): Promise<boolean> {
  const id = await reportAction(
    trackDownload(progressOf(URL_DOWNLOAD), async (onProgress) => {
      if (!(await ensureEngine())) return null;
      const downloaded = await downloadModelFromUrl(url, onProgress);
      await afterDownload(downloaded);
      return downloaded;
    }),
  );
  return typeof id === "string";
}

export const visionDownload = (id: string) => `vision:${id}`;

export const downloadAiVision = (id: string) =>
  reportAction(
    trackDownload(progressOf(visionDownload(id)), async (onProgress) => {
      await downloadVision(id, onProgress);
      await afterDownload(null);
    }),
  );

export const cancelAiVisionDownload = (id: string) => void cancelVisionDownload(id);

export async function removeAiVision(id: string) {
  if (!(await reportSucceeded(deleteVision(id)))) return;
  await reportAction(afterDownload(null));
}

export async function removeAiModel(id: string) {
  if (!(await reportSucceeded(deleteLocalModel(id)))) return;
  clearDefaultIf({ provider: LOCAL_PROVIDER, model: id });
  await reportAction(afterDownload(null));
}

const newProviderId = () => crypto.randomUUID().slice(0, 8);

export function saveProvider(provider: Omit<ProviderConfig, "id"> & { id: string | null }) {
  const { providers } = getSettings().ai;
  const saved: ProviderConfig = { ...provider, id: provider.id ?? newProviderId() };
  const exists = providers.some((existing) => existing.id === saved.id);
  updateAiSettings({
    providers: exists
      ? providers.map((existing) => (existing.id === saved.id ? saved : existing))
      : [...providers, saved],
  });
  void refreshModels();
}

export function setProviderEnabled(id: string, enabled: boolean) {
  const { providers } = getSettings().ai;
  updateAiSettings({
    providers: providers.map((provider) => (provider.id === id ? { ...provider, enabled } : provider)),
  });
  void refreshModels();
}

export function removeProvider(id: string) {
  const { providers, model } = getSettings().ai;
  updateAiSettings({
    providers: providers.filter((provider) => provider.id !== id),
    model: model?.provider === id ? null : model,
  });
  void refreshModels();
}

export async function pullModel(provider: string, model: string) {
  const name = model.trim();
  if (!name) return;
  await reportAction(
    trackDownload(pullProgressOf(provider, name), async (onProgress) => {
      await pullOllamaModel(provider, name, onProgress);
      await refreshModels();
    }),
  );
}

export const cancelPull = (provider: string, model: string) => void cancelOllamaPull(provider, model);

export async function removeOllamaModel(provider: string, model: string) {
  if (!(await reportSucceeded(deleteOllamaModel(provider, model)))) return;
  clearDefaultIf({ provider, model });
  await refreshModels();
}
