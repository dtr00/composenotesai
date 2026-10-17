import { invoke } from "@tauri-apps/api/core";

export type NoteFormat = "markdown" | "excalidraw";

export interface NoteSummary {
  format: NoteFormat;
  id: number;
  title: string;
  parentId: number | null;
}

export interface Note extends NoteSummary {
  body: string;
}

export interface SearchHit extends NoteSummary {
  snippet: string;
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  collapsed: boolean;
}

export type MediaType = "image" | "video" | "document";
export type EntryType = "note" | "folder" | MediaType;
export type EntryCounts = Partial<Record<EntryType, number>>;

export interface MediaSummary {
  id: number;
  name: string;
  parentId: number | null;
  mediaType: MediaType;
  mime: string;
  bytes: number;
}

export type NoteEntry = { kind: "note" } & NoteSummary;
export type FolderEntry = { kind: "folder" } & Folder;
export type MediaEntry = { kind: "media" } & MediaSummary;
export type Entry = NoteEntry | FolderEntry | MediaEntry;
export type EntryOf<K extends Entry["kind"]> = Extract<Entry, { kind: K }>;
export interface EntryRef {
  kind: Entry["kind"];
  id: number;
}

export const toRef = ({ kind, id }: EntryRef): EntryRef => ({ kind, id });

export const createNote = (parentId: number | null, title: string | null = null, format: NoteFormat = "markdown") =>
  invoke<NoteSummary>("create_note", { parentId, title, format });
export const createFolder = (parentId: number | null) => invoke<Folder>("create_folder", { parentId });
export const listEntries = () => invoke<Entry[]>("list_entries");
export const loadNote = (id: number) => invoke<Note>("load_note", { id });
export const searchNotes = (query: string, limit: number) => invoke<SearchHit[]>("search_notes", { query, limit });
export const saveNote = (id: number, body: string) => invoke<void>("save_note", { id, body });
export const renameNote = (id: number, title: string) => invoke<string | null>("rename_note", { id, title });
export const renameFolder = (id: number, name: string) => invoke<string | null>("rename_folder", { id, name });
export const setFolderCollapsed = (id: number, collapsed: boolean) =>
  invoke<void>("set_folder_collapsed", { id, collapsed });
export const setAllFoldersCollapsed = (collapsed: boolean) => invoke<void>("set_all_folders_collapsed", { collapsed });
export const createMedia = (bytes: ArrayBuffer, name: string, parentId: number | null) =>
  invoke<MediaSummary>("create_media", bytes, {
    headers: {
      "x-media-name": encodeURIComponent(name),
      ...(parentId === null ? {} : { "x-folder-id": String(parentId) }),
    },
  });
export const importMedia = (path: string, parentId: number | null) =>
  invoke<MediaSummary>("import_media", { path, parentId });
export const copiedFiles = () => invoke<string[]>("copied_files");
export const renameMedia = (id: number, name: string) => invoke<string | null>("rename_media", { id, name });

export interface MediaFormat {
  mime: string;
  label: string;
  extensions: string[];
  mediaType: MediaType;
}
interface MediaConfig {
  base: string;
  formats: MediaFormat[];
}

let mediaConfig: MediaConfig | null = null;

export async function loadMediaConfig() {
  mediaConfig = await invoke<MediaConfig>("media_config");
}

function loadedMediaConfig() {
  if (mediaConfig === null) throw new Error("Media are used before loadMediaConfig loaded their config.");
  return mediaConfig;
}

export const mediaSource = (id: number) => `${loadedMediaConfig().base}/${id}`;
export const mediaFormats = () => loadedMediaConfig().formats;

export interface MediaLink {
  mediaId: number;
  note: NoteSummary;
}
export interface MediaInfo {
  createdAt: number;
  notes: NoteSummary[];
}
export const mediaLinks = (ids: number[]) => invoke<MediaLink[]>("media_links", { ids });
export const mediaInfo = (id: number) => invoke<MediaInfo>("media_info", { id });
export const readMedia = (id: number) => invoke<ArrayBuffer>("read_media", { id });
export const duplicateEntry = (entry: EntryRef) => invoke<EntryRef>("duplicate_entry", { entry: toRef(entry) });
export interface Trashed {
  trashIds: number[];
  removed: EntryRef[];
}

export interface TrashItem {
  id: number;
  entry: EntryRef;
  name: string;
  deletedAt: number;
  entryType: EntryType;
  counts: EntryCounts;
  bytes: number;
}

export const trashEntries = (entries: EntryRef[]) => invoke<Trashed>("trash_entries", { entries: entries.map(toRef) });
export const restoreTrash = (ids: number[]) => invoke<EntryRef[]>("restore_trash", { ids });
export const listTrash = () => invoke<TrashItem[]>("list_trash");
export const deleteFromTrash = (ids: number[]) => invoke<void>("delete_from_trash", { ids });
export const emptyTrash = () => invoke<void>("empty_trash");
export const moveEntries = (entries: EntryRef[], parentId: number | null, index: number) =>
  invoke<void>("move_entries", { entries: entries.map(toRef), parentId, index });
