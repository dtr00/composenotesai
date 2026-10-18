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

interface InsertRange {
  from: number;
  to: number;
}

const trackInsert = StateEffect.define<InsertRange & { id: number }>();
const untrackInsert = StateEffect.define<number>();

const pendingInserts = StateField.define<ReadonlyMap<number, InsertRange>>({
  create: () => new Map(),
  update(pending, tr) {
    const effects = tr.effects.filter((effect) => effect.is(trackInsert) || effect.is(untrackInsert));
    if ((tr.changes.empty || pending.size === 0) && effects.length === 0) return pending;
    const next = new Map(
      [...pending].map(([id, { from, to }]) => {
        const start = tr.changes.mapPos(from, -1);
        const end = tr.changes.touchesRange(from, to) ? start : tr.changes.mapPos(to, -1);
        return [id, { from: start, to: end }];
      }),
    );
    for (const effect of effects) {
      if (effect.is(trackInsert)) next.set(effect.value.id, effect.value);
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
  view.dispatch({ effects: trackInsert.of({ id, from, to }) });
  return id;
}

function insertMedia(view: EditorView, id: number, media: MediaSummary) {
  const range = view.state.field(pendingInserts).get(id);
  if (!range) return false;
  const { from: pos, to } = range;
  const { state } = view;
  const line = state.doc.lineAt(pos);
  const before = state.sliceDoc(line.from, pos).trim() === "" ? "" : "\n";
  const insert = `${before}${mediaMarkdown(media)}\n`;
  const end = pos + insert.length;
  const cursorStayed = state.selection.main.from === pos && state.selection.main.to === to;
  view.dispatch({
    changes: { from: pos, to, insert },
    selection: cursorStayed ? { anchor: end } : undefined,
    effects: trackInsert.of({ id, from: end, to: end }),
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
  copiedImage: () => Promise<File | null>;
  onUnreadable: () => void;
}

const hidesCopiedFiles = (data: DataTransfer) =>
  data.types.includes("text/uri-list") && data.getData("text/uri-list") === "";

function holdsHtmlImage(data: DataTransfer) {
  const html = data.getData("text/html");
  if (!html) return false;
  const { body } = new DOMParser().parseFromString(html, "text/html");
  return body.textContent?.trim() === "" && body.querySelector("img") !== null;
}

async function pasteNativeMedia(view: EditorView, id: number, data: DataTransfer, paste: MediaHost) {
  const sources: MediaSource[] = await (
    hidesCopiedFiles(data)
      ? paste.copiedFiles().then((paths) => paths.filter(isMediaFileName))
      : paste.copiedImage().then((image) => (image ? [image] : []))
  ).catch(() => []);
  if (sources.length > 0) return saveAndInsert(view, id, sources, paste.save);
  if (view.dom.isConnected) view.dispatch({ effects: untrackInsert.of(id) });
  paste.onUnreadable();
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
        if (!hidesCopiedFiles(data) && !holdsMedia(data) && !holdsHtmlImage(data)) return false;
        event.preventDefault();
        void pasteNativeMedia(view, startInsert(view, from, to), data, paste);
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
