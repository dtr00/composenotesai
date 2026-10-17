import { Channel, invoke } from "@tauri-apps/api/core";
import type { DownloadProgress } from "./download";
import type { ProviderConfig } from "./settings";

export type SourceKind = "local" | "ollama" | "openAi";

export interface RemoteModel {
  id: string;
  name: string;
  sizeBytes: number | null;
  details: string | null;
  vision: boolean;
}

export interface ProviderModels {
  provider: string;
  name: string;
  kind: SourceKind;
  models: RemoteModel[];
  error: string | null;
}

export interface LocalModel {
  id: string;
  name: string;
  description: string | null;
  sizeBytes: number;
  installed: boolean;
  custom: boolean;
  vision: { sizeBytes: number; installed: boolean } | null;
}

export interface EngineInfo {
  available: boolean;
  installed: boolean;
  installing: boolean;
  build: string;
  downloadBytes: number;
  installedBytes: number;
  loadedModel: string | null;
}

export interface WireToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface WireImage {
  mimeType: "image/png" | "image/jpeg";
  data: string;
}

export type WireMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string; images?: WireImage[] }
  | { role: "assistant"; content: string; toolCalls: WireToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; toolName: string };

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  provider: string;
  model: string;
  messages: WireMessage[];
  tools: ToolSpec[];
}

export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "toolCall"; index: number; id: string | null; name: string | null; arguments: string }
  | {
      type: "done";
      finishReason: string | null;
      promptTokens: number | null;
      completionTokens: number | null;
      tokensPerSecond: number | null;
    };

const progressChannel = (onProgress: (progress: DownloadProgress) => void) => new Channel<DownloadProgress>(onProgress);

export const listModels = () => invoke<ProviderModels[]>("ai_models");

export const testProvider = (provider: ProviderConfig) => invoke<RemoteModel[]>("ai_test_provider", { provider });

export const streamChat = (runId: string, request: ChatRequest, onEvent: (event: ChatEvent) => void) =>
  invoke<void>("ai_chat", { runId, request, onEvent: new Channel<ChatEvent>(onEvent) });

export const cancelChat = (runId: string) => invoke<void>("ai_chat_cancel", { runId });

export const loadEngine = () => invoke<EngineInfo>("ai_engine");

export const installEngine = (onProgress: (progress: DownloadProgress) => void) =>
  invoke<boolean>("ai_install_engine", { onProgress: progressChannel(onProgress) });

export const cancelEngineInstall = () => invoke<void>("ai_cancel_engine_install");

export const uninstallEngine = () => invoke<void>("ai_uninstall_engine");

export const unloadModel = () => invoke<void>("ai_unload_model");

export const listLocalModels = () => invoke<LocalModel[]>("ai_local_models");

export const downloadLocalModel = (id: string, onProgress: (progress: DownloadProgress) => void) =>
  invoke<boolean>("ai_download_model", { id, onProgress: progressChannel(onProgress) });

export const downloadModelFromUrl = (url: string, onProgress: (progress: DownloadProgress) => void) =>
  invoke<string | null>("ai_download_model_url", { url, onProgress: progressChannel(onProgress) });

export const cancelModelDownload = (id: string) => invoke<void>("ai_cancel_model_download", { id });

export const deleteLocalModel = (id: string) => invoke<void>("ai_delete_model", { id });

export const downloadVision = (id: string, onProgress: (progress: DownloadProgress) => void) =>
  invoke<boolean>("ai_download_vision", { id, onProgress: progressChannel(onProgress) });

export const cancelVisionDownload = (id: string) => invoke<void>("ai_cancel_vision_download", { id });

export const deleteVision = (id: string) => invoke<void>("ai_delete_vision", { id });

export const pullOllamaModel = (provider: string, model: string, onProgress: (progress: DownloadProgress) => void) =>
  invoke<boolean>("ai_ollama_pull", { provider, model, onProgress: progressChannel(onProgress) });

export const cancelOllamaPull = (provider: string, model: string) =>
  invoke<void>("ai_ollama_cancel_pull", { provider, model });

export const deleteOllamaModel = (provider: string, model: string) =>
  invoke<void>("ai_ollama_delete", { provider, model });

export interface ImageResult {
  title: string;
  url: string;
  width: number | null;
  height: number | null;
  creator: string | null;
  license: string | null;
  source: string;
  page: string | null;
}

export const searchImages = (query: string, limit?: number) =>
  invoke<ImageResult[]>("ai_search_images", { query, limit: limit ?? null });

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebPage {
  url: string;
  title: string | null;
  text: string;
  truncated: boolean;
}

export const searchWeb = (query: string, limit?: number) =>
  invoke<SearchResult[]>("ai_search_web", { query, limit: limit ?? null });

export const readWebPage = (url: string) => invoke<WebPage>("ai_read_web_page", { url });
