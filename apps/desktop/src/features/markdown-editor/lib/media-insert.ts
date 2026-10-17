import { StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { MediaSummary } from "../../../shared/api/notes";
import { isMediaFileName, isMediaMime } from "../../../shared/config/media-types";
import { mediaMarkdown } from "./media-markdown";

export type MediaSource = File | string;

export type SaveMedia = (source: MediaSource) => Promise<MediaSummary | undefined>;

const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/])/;
const WINDOWS_DRIVE_URL_PATH = /^\/[A-Za-z]:\//;

let nextInsertId = 0;

const trackInsert = StateEffect.define<{ id: number; pos: number }>();
const untrackInsert = StateEffect.define<number>();

const pendingInserts = StateField.define<ReadonlyMap<number, number>>({
  create: () => new Map(),
  update(pending, tr) {
    const effects = tr.effects.filter((effect) => effect.is(trackInsert) || effect.is(untrackInsert));
    if ((tr.changes.empty || pending.size === 0) && effects.length === 0) return pending;
    const next = new Map([...pending].map(([id, pos]) => [id, tr.changes.mapPos(pos, -1)]));
    for (const effect of effects) {
      if (effect.is(trackInsert)) next.set(effect.value.id, effect.value.pos);
      if (effect.is(untrackInsert)) next.delete(effect.value);
    }
    return next;
  },
});

const isMediaType = (type: string) => type.startsWith("image/") || type.startsWith("video/");

const isMediaFile = (file: File | null): file is File =>
  file !== null && (isMediaMime(file.type) || (file.type === "" && isMediaFileName(file.name)));

function fileUrlPath(line: string) {
  try {
    const path = decodeURIComponent(new URL(line).pathname);
    return WINDOWS_DRIVE_URL_PATH.test(path) ? path.slice(1) : path;
  } catch {
    return null;
  }
}

function copiedMediaPaths(data: DataTransfer): string[] {
  const text = data.getData("text/uri-list") || data.getData("text/plain");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => (line.startsWith("file://") ? (fileUrlPath(line) ?? []) : [line]))
    .filter((path) => ABSOLUTE_PATH.test(path) && isMediaFileName(path));
}

function clipboardMedia(data: DataTransfer): MediaSource[] {
  const fromItems = [...data.items].map((item) => (item.kind === "file" ? item.getAsFile() : null));
  const files = fromItems.filter(isMediaFile);
  if (files.length > 0) return files;
  const listed = [...data.files].filter(isMediaFile);
  return listed.length > 0 ? listed : copiedMediaPaths(data);
}

function startInsert(view: EditorView, from: number, to: number) {
  const id = nextInsertId++;
  view.dispatch({ changes: from === to ? [] : { from, to }, effects: trackInsert.of({ id, pos: from }) });
  return id;
}

function insertMedia(view: EditorView, id: number, media: MediaSummary) {
  const pos = view.state.field(pendingInserts).get(id);
  if (pos === undefined) return false;
  const { state } = view;
  const line = state.doc.lineAt(pos);
  const before = state.sliceDoc(line.from, pos).trim() === "" ? "" : "\n";
  const insert = `${before}${mediaMarkdown(media)}\n`;
  const end = pos + insert.length;
  const cursorStayed = state.selection.main.empty && state.selection.main.head === pos;
  view.dispatch({
    changes: { from: pos, insert },
    selection: cursorStayed ? { anchor: end } : undefined,
    effects: trackInsert.of({ id, pos: end }),
    scrollIntoView: cursorStayed,
    userEvent: "input.paste",
  });
  return true;
}

async function saveAndInsert(view: EditorView, id: number, sources: MediaSource[], save: SaveMedia) {
  try {
    for (const source of sources) {
      const media = await save(source);
      if (!media || !view.dom.isConnected || !insertMedia(view, id, media)) break;
    }
  } finally {
    if (view.dom.isConnected) view.dispatch({ effects: untrackInsert.of(id) });
  }
}

const holdsMedia = (data: DataTransfer) => [...data.types].some((type) => type === "Files" || isMediaType(type));

export interface MediaHost {
  save: SaveMedia;
  copiedFiles: () => Promise<string[]>;
  onUnreadable: () => void;
}

const hidesCopiedFiles = (data: DataTransfer) =>
  data.types.includes("text/uri-list") && data.getData("text/uri-list") === "";

async function pasteCopiedFiles(view: EditorView, id: number, { save, copiedFiles, onUnreadable }: MediaHost) {
  const paths = (await copiedFiles().catch(() => [])).filter(isMediaFileName);
  if (paths.length > 0) return saveAndInsert(view, id, paths, save);
  if (view.dom.isConnected) view.dispatch({ effects: untrackInsert.of(id) });
  onUnreadable();
}

export function mediaInsertion(paste: MediaHost) {
  return [
    pendingInserts,
    EditorView.domEventHandlers({
      paste(event, view) {
        const data = event.clipboardData;
        if (!data) return false;
        const sources = clipboardMedia(data);
        const { from, to } = view.state.selection.main;
        if (sources.length > 0) {
          event.preventDefault();
          void saveAndInsert(view, startInsert(view, from, to), sources, paste.save);
          return true;
        }
        if (hidesCopiedFiles(data)) {
          event.preventDefault();
          void pasteCopiedFiles(view, startInsert(view, from, to), paste);
          return true;
        }
        if (!holdsMedia(data)) return false;
        event.preventDefault();
        paste.onUnreadable();
        return true;
      },
    }),
  ];
}

export function pickMedia(accept: string, save: SaveMedia) {
  return (view: EditorView) => {
    const head = view.state.selection.main.head;
    const id = startInsert(view, head, head);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.addEventListener("change", () => void saveAndInsert(view, id, [...(input.files ?? [])], save));
    input.addEventListener("cancel", () => view.dispatch({ effects: untrackInsert.of(id) }));
    input.click();
  };
}
