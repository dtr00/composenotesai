import { invoke } from "@tauri-apps/api/core";

export interface NotesUsage {
  notes: number;
  folders: number;
  textBytes: number;
  noteBytes: number;
  folderBytes: number;
  media: number;
  mediaBytes: number;
  trashBytes: number;
}

export type SettingGroup = "general" | "appearance" | "keybindings" | "trash" | "ai" | "other";

export interface SettingBytes {
  key: string;
  group: SettingGroup;
  bytes: number;
}

export interface WebviewBytes {
  name: string;
  bytes: number;
}

export interface StoredModel {
  name: string;
  bytes: number;
}

export interface AiDataUsage {
  chats: number;
  chatBytes: number;
  skillBytes: number;
}

export interface StorageUsage {
  folder: string;
  appBytes: number;
  databaseBytes: number;
  logBytes: number;
  backgroundBytes: number;
  settings: SettingBytes[];
  notes: NotesUsage;
  ai: AiDataUsage;
  webview: WebviewBytes[];
  speechModels: StoredModel[];
  languageModels: StoredModel[];
  engineBytes: number;
}

export const loadStorageUsage = () => invoke<StorageUsage>("storage_usage");
