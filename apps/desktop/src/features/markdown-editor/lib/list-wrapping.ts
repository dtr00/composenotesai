import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";

type Hangs = ReadonlyMap<number, number>;

const HANGING_CLASS = "cm-md-hanging";

const setHangs = StateEffect.define<Hangs>();

function hangDecorations(hangs: Hangs): DecorationSet {
  const lines: Range<Decoration>[] = [...hangs].map(([from, px]) =>
    Decoration.line({
      class: HANGING_CLASS,
      attributes: { style: `padding-left: ${px}px; text-indent: -${px}px` },
    }).range(from),
  );
  return Decoration.set(lines, true);
}

const hangField = StateField.define<{ hangs: Hangs; decorations: DecorationSet }>({
  create: () => ({ hangs: new Map(), decorations: Decoration.none }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHangs)) return { hangs: effect.value, decorations: hangDecorations(effect.value) };
    }
    return tr.docChanged ? { ...value, decorations: value.decorations.map(tr.changes) } : value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

function contentStart(state: EditorState, item: SyntaxNodeRef) {
  const marker = item.node.getChild("Task")?.getChild("TaskMarker") ?? item.node.getChild("ListMark");
  if (!marker) return null;
  return state.sliceDoc(marker.to, marker.to + 1) === " " ? marker.to + 1 : marker.to;
}

function measureHangs(view: EditorView): Hangs {
  const { state } = view;
  const hangs = new Map<number, number>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "FencedCode" || node.name === "CodeBlock") return false;
        if (node.name !== "ListItem") return;
        const content = contentStart(state, node);
        const line = state.doc.lineAt(node.from);
        if (content === null || content > line.to) return;
        const start = view.coordsAtPos(line.from, 1);
        const text = view.coordsAtPos(content, 1);
        if (!start || !text || Math.abs(text.top - start.top) > 1) return;
        const hang = Math.round(text.left - start.left);
        if (hang > 0) hangs.set(line.from, hang);
      },
    });
  }
  return hangs;
}

const sameHangs = (a: Hangs, b: Hangs) => a.size === b.size && [...a].every(([from, px]) => b.get(from) === px);

const hangMeasurer = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      this.request(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged ||
        update.selectionSet ||
        update.focusChanged
      )
        this.request(update.view);
    }

    request(view: EditorView) {
      view.requestMeasure({
        key: this,
        read: measureHangs,
        write: (hangs) => {
          if (sameHangs(hangs, view.state.field(hangField).hangs)) return;
          queueMicrotask(() => view.dispatch({ effects: setHangs.of(hangs) }));
        },
      });
    }
  },
);

export const listWrapping = [
  hangField,
  hangMeasurer,
  EditorView.theme({ [`.${HANGING_CLASS} > *`]: { textIndent: "0" } }),
];
