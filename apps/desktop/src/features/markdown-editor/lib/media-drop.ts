import { StateEffect, StateField, type Text } from "@codemirror/state";
import { EditorView, layer, RectangleMarker, ViewPlugin } from "@codemirror/view";
import type { MediaSummary } from "../../../shared/api/notes";
import { mediaMarkdown } from "./media-markdown";
import { isEditable } from "./widget-roots";

export const DROP_PANE_ATTRIBUTE = "data-media-drop-pane";

const dropTargets = new Set<EditorView>();

const DROP_LINE_PX = 2;

interface DropSpot {
  from: number;
  below: boolean;
}

const setDropSpot = StateEffect.define<DropSpot | null>();

const dropSpot = StateField.define<DropSpot | null>({
  create: () => null,
  update(spot, tr) {
    for (const effect of tr.effects) if (effect.is(setDropSpot)) return effect.value;
    return tr.docChanged ? null : spot;
  },
});

function dropLine(view: EditorView) {
  const spot = view.state.field(dropSpot);
  if (!spot) return [];
  const block = view.lineBlockAt(spot.from);
  const scroller = view.scrollDOM.getBoundingClientRect();
  const content = view.contentDOM.getBoundingClientRect();
  const left = content.left - scroller.left + view.scrollDOM.scrollLeft;
  const y = view.documentTop + (spot.below ? block.bottom : block.top) - scroller.top + view.scrollDOM.scrollTop;
  return [new RectangleMarker("cm-md-drop-line", left, y - DROP_LINE_PX / 2, content.width, DROP_LINE_PX)];
}

export const mediaDrop = [
  dropSpot,
  ViewPlugin.define((view) => {
    dropTargets.add(view);
    return { destroy: () => dropTargets.delete(view) };
  }),
  layer({
    above: true,
    markers: dropLine,
    update: (update) => update.startState.field(dropSpot) !== update.state.field(dropSpot),
  }),
  EditorView.theme({
    ".cm-md-drop-line": { backgroundColor: "var(--primary)", borderRadius: `${DROP_LINE_PX}px` },
  }),
];

function accepts(view: EditorView, x: number, y: number) {
  const pane = (view.dom.closest(`[${DROP_PANE_ATTRIBUTE}]`) ?? view.dom).getBoundingClientRect();
  const top = view.dom.getBoundingClientRect().top;
  return x >= pane.left && x <= pane.right && y >= top && y <= pane.bottom;
}

export const editorAt = (x: number, y: number) =>
  [...dropTargets].find((view) => isEditable(view.state) && accepts(view, x, y)) ?? null;

export function showMediaDrop(view: EditorView, y: number) {
  const block = view.lineBlockAtHeight(y - view.documentTop);
  const below = y > view.documentTop + block.top + block.height / 2;
  const current = view.state.field(dropSpot);
  if (current?.from === block.from && current.below === below) return;
  view.dispatch({ effects: setDropSpot.of({ from: block.from, below }) });
}

export const clearMediaDrop = (view: EditorView) => view.dispatch({ effects: setDropSpot.of(null) });

function dropInsertion(doc: Text, block: { from: number; to: number }, below: boolean, markdown: string) {
  const filled = (line: number) => line >= 1 && line <= doc.lines && doc.line(line).length > 0;
  const first = doc.lineAt(block.from).number;
  const last = doc.lineAt(block.to).number;
  if (block.from === block.to) {
    const lead = filled(first - 1) ? "\n" : "";
    return {
      at: block.from,
      insert: `${lead}${markdown}${filled(first + 1) ? "\n" : ""}`,
      cursor: lead.length + markdown.length,
    };
  }
  if (below) {
    return { at: block.to, insert: `\n\n${markdown}${filled(last + 1) ? "\n" : ""}`, cursor: markdown.length + 2 };
  }
  const lead = filled(first - 1) ? "\n" : "";
  return { at: block.from, insert: `${lead}${markdown}\n\n`, cursor: lead.length + markdown.length };
}

export function dropMedia(view: EditorView, media: MediaSummary[]) {
  const spot = view.state.field(dropSpot);
  if (!spot) return;
  const markdown = media.map(mediaMarkdown).join("\n\n");
  const { at, insert, cursor } = dropInsertion(view.state.doc, view.lineBlockAt(spot.from), spot.below, markdown);
  view.dispatch({
    changes: { from: at, insert },
    selection: { anchor: at + cursor },
    effects: setDropSpot.of(null),
    userEvent: "input.drop",
  });
  view.focus();
}
