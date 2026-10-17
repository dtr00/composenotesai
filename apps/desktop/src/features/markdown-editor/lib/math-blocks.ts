import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { renderMath } from "../../../shared/lib/math";
import { isMathNode, mathSource } from "../../../shared/lib/math-syntax";
import { outermostNodes, perParse, selectionTouches } from "./markdown-syntax";
import { decorationField, isEditable } from "./widget-roots";

const SKIPPED = new Set(["FencedCode", "CodeBlock", "InlineCode"]);

class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return other.tex === this.tex && other.display === this.display;
  }

  toDOM() {
    const dom = document.createElement(this.display ? "div" : "span");
    dom.className = this.display ? "cm-md-math-block" : "cm-md-math";
    renderMath(dom, this.tex, this.display);
    return dom;
  }

  ignoreEvent() {
    return false;
  }
}

function standsOnOwnLines(state: EditorState, from: number, to: number) {
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to);
  return !state.sliceDoc(first.from, from).trim() && !state.sliceDoc(to, last.to).trim();
}

interface MathSpan {
  tex: string;
  display: boolean;
  block: boolean;
  from: number;
  to: number;
  last: number;
}

const mathIn = perParse((state): MathSpan[] => {
  const text = state.doc.toString();
  return outermostNodes(state, isMathNode, SKIPPED).map((node) => {
    const display = node.name === "DisplayMath";
    const block = display && standsOnOwnLines(state, node.from, node.to);
    const last = state.doc.lineAt(node.to).to;
    const tex = mathSource(text, node.name, node.from, node.to);
    return block
      ? { tex, display, block, from: state.doc.lineAt(node.from).from, to: last, last }
      : { tex, display, block, from: node.from, to: node.to, last };
  });
});

function mathDecorations(state: EditorState): DecorationSet {
  const editable = isEditable(state);
  const decorations: Range<Decoration>[] = [];
  for (const { tex, display, block, from, to, last } of mathIn(state)) {
    const editing = editable && selectionTouches(state, from, to);
    const widget = new MathWidget(tex, display);
    if (block && editing) decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(last));
    else if (block) decorations.push(Decoration.replace({ widget, block: true }).range(from, to));
    else if (!editing) decorations.push(Decoration.replace({ widget }).range(from, to));
  }
  return Decoration.set(decorations, true);
}

export const mathBlocks = [
  decorationField(mathDecorations, { followSelection: true }),
  EditorView.theme({
    ".cm-md-math": { cursor: "text" },
    ".cm-md-math-block": { padding: "0.35em 0", overflowX: "auto", cursor: "text" },
  }),
];
