import { getEntries, loadNoteList } from "../../../entities/note/model/note-list-store";
import { findEntry } from "../../../entities/note/model/note-tree";
import { getSettings } from "../../../entities/settings/model/settings-store";
import { createMedia, importMedia, type MediaSummary } from "../../../shared/api/notes";
import type { MediaSource } from "../../../features/markdown-editor/lib/media-insert";
import { reportAction, showError } from "../../../shared/lib/error-toast";

const GENERIC_CLIPBOARD_NAME = /^(image|video)\.\w+$/;

function mediaFolderId(): number | null {
  const { mediaFolderId } = getSettings();
  if (mediaFolderId === null) return null;
  return findEntry(getEntries(), { kind: "folder", id: mediaFolderId }) ? mediaFolderId : null;
}

const fileName = (file: File) => (GENERIC_CLIPBOARD_NAME.test(file.name) ? "" : file.name);

async function createFrom(source: MediaSource) {
  const folderId = mediaFolderId();
  if (typeof source === "string") return importMedia(source, folderId);
  return createMedia(await source.arrayBuffer(), fileName(source), folderId);
}

export async function saveMedia(source: MediaSource): Promise<MediaSummary | undefined> {
  const media = await reportAction(createFrom(source));
  if (media) await loadNoteList();
  return media;
}

export const reportUnreadableMedia = () => showError("Cannot read pasted file.");
