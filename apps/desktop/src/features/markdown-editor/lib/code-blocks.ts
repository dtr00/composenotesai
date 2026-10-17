import { Prec, type EditorState, type Line, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType, type DecorationSet } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { createElement } from "react";
import { showError } from "../../../shared/lib/error-toast";
import { CODE_HEADER_CONTROL, CodeBlockHeader } from "../ui/code-block-header";
import { formatCode, formatError } from "./code-format";
import { codeLanguage } from "./code-languages";
import { nodeAt, outermostNodes, perParse, selectionTouches } from "./markdown-syntax";
import { MONO } from "./monospace";
import { decorationField, isEditable, ReactWidget } from "./widget-roots";

const OPENING_FENCE = /^(`{3,}|~{3,})([^`\s]*)\s*$/;

interface CodeBlock {
  open: Line;
  close: Line | null;
  info: { from: number; to: number };
  text: { from: number; to: number } | null;
}

function readCodeBlock(state: EditorState, node: SyntaxNode): CodeBlock {
  const marks = node.getChildren("CodeMark");
  const info = node.getChild("CodeInfo");
  const text = node.getChild("CodeText");
  const open = state.doc.lineAt(node.from);
  const last = marks.length > 1 ? state.doc.lineAt(marks[marks.length - 1].from) : null;
  const infoAt = marks[0]?.to ?? open.to;
  return {
    open,
    close: last && last.number > open.number ? last : null,
    info: info ? { from: info.from, to: info.to } : { from: infoAt, to: infoAt },
    text: text ? { from: text.from, to: text.to } : null,
  };
}

const codeBlocksIn = perParse((state): CodeBlock[] =>
  outermostNodes(state, (name) => name === "FencedCode").map((node) => readCodeBlock(state, node)),
);

function blockAt(state: EditorState, pos: number) {
  const node = nodeAt(state, pos, "FencedCode");
  return node ? readCodeBlock(state, node) : null;
}

function setLanguage(view: EditorView, dom: HTMLElement, id: string) {
  const block = blockAt(view.state, view.posAtDOM(dom));
  if (!block) return;
  view.dispatch({ changes: { ...block.info, insert: id }, userEvent: "input" });
}

async function prettify(view: EditorView, dom: HTMLElement) {
  const block = blockAt(view.state, view.posAtDOM(dom));
  const parser = block && codeLanguage(view.state.sliceDoc(block.info.from, block.info.to)).parser;
  if (!block?.text || !parser) return;
  const code = view.state.sliceDoc(block.text.from, block.text.to);
  try {
    const formatted = await formatCode(code, parser);
    const current = blockAt(view.state, block.open.from);
    if (!current?.text || view.state.sliceDoc(current.text.from, current.text.to) !== code || formatted === code)
      return;
    view.dispatch({ changes: { ...current.text, insert: formatted }, userEvent: "input.format" });
  } catch (error) {
    showError(formatError(error));
  }
}

class CodeHeaderWidget extends ReactWidget {
  protected readonly tag = "div";
  protected readonly className = "cm-md-code-header";

  constructor(
    readonly info: string,
    readonly editable: boolean,
  ) {
    super();
  }

  eq(other: CodeHeaderWidget) {
    return other.info === this.info && other.editable === this.editable;
  }

  ignoreEvent(event: Event) {
    return event.target instanceof Element && event.target.closest(CODE_HEADER_CONTROL) !== null;
  }

  protected element(view: EditorView, dom: HTMLElement) {
    return createElement(CodeBlockHeader, {
      language: codeLanguage(this.info),
      editable: this.editable,
      onLanguage: (id) => setLanguage(view, dom, id),
      onPrettify: () => prettify(view, dom),
    });
  }
}

class CodeFooterWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const dom = document.createElement("div");
    dom.className = "cm-md-code-footer";
    return dom;
  }
}

const footer = Decoration.replace({ widget: new CodeFooterWidget(), block: true });
const codeLine = (extra = "") => Decoration.line({ class: `cm-md-code-line ${extra}`.trim() });

const touches = (state: EditorState, line: Line) => selectionTouches(state, line.from, line.to);

function cards(state: EditorState): DecorationSet {
  const editable = isEditable(state);
  const decorations: Range<Decoration>[] = [];
  for (const block of codeBlocksIn(state)) {
    const { open, close } = block;
    const hasContent = close === null || close.number > open.number + 1;
    const rawOpen = touches(state, open) || !hasContent;
    const rawClose = close !== null && (touches(state, close) || !hasContent);
    const info = state.sliceDoc(block.info.from, block.info.to);
    decorations.push(
      rawOpen
        ? codeLine("cm-md-code-first").range(open.from)
        : Decoration.replace({ widget: new CodeHeaderWidget(info, editable), block: true }).range(open.from, open.to),
    );
    const lastContent = close ? close.number - 1 : state.doc.lineAt((block.text ?? open).to).number;
    for (let number = open.number + 1; number <= lastContent; number++) {
      decorations.push(
        codeLine(close ? "" : number === lastContent ? "cm-md-code-last" : "").range(state.doc.line(number).from),
      );
    }
    if (close)
      decorations.push(rawClose ? codeLine("cm-md-code-last").range(close.from) : footer.range(close.from, close.to));
  }
  return Decoration.set(decorations, true);
}

const cardField = decorationField(cards, { followSelection: true });

function closeFence(view: EditorView) {
  const { state } = view;
  const { main } = state.selection;
  const line = state.doc.lineAt(main.head);
  const fence = OPENING_FENCE.exec(line.text);
  if (!main.empty || main.head !== line.to || !fence) return false;
  const block = blockAt(state, line.from);
  if (!block || block.open.number !== line.number || block.close) return false;
  view.dispatch({
    changes: { from: line.to, insert: `\n\n${fence[1]}` },
    selection: { anchor: line.to + 1 },
    userEvent: "input",
  });
  return true;
}

function guardFence(view: EditorView) {
  const { state } = view;
  const { main } = state.selection;
  if (!main.empty) return false;
  const line = state.doc.lineAt(main.head);
  const block = blockAt(state, line.from);
  if (!block || main.head !== line.from || line.number !== block.open.number + 1) return false;
  if (block.close?.number === line.number + 1 && line.length === 0) {
    const to = Math.min(state.doc.length, block.close.to + (block.close.to < state.doc.length ? 1 : 0));
    view.dispatch({
      changes: { from: block.open.from, to },
      selection: { anchor: block.open.from },
      userEvent: "delete",
    });
  }
  return true;
}

const CARD_RADIUS = "var(--radius-lg)";
const CARD_PAD = "0.5rem";

export const codeBlocks = [
  cardField,
  Prec.high(
    keymap.of([
      { key: "Enter", run: closeFence },
      { key: "Backspace", run: guardFence },
    ]),
  ),
  EditorView.theme({
    ".cm-line.cm-md-code-line": {
      fontFamily: MONO,
      fontSize: "0.875em",
      backgroundColor: "var(--muted)",
      padding: "0 1rem",
    },
    ".cm-line.cm-md-code-first": {
      borderTopLeftRadius: CARD_RADIUS,
      borderTopRightRadius: CARD_RADIUS,
      paddingTop: CARD_PAD,
    },
    ".cm-line.cm-md-code-last": {
      borderBottomLeftRadius: CARD_RADIUS,
      borderBottomRightRadius: CARD_RADIUS,
      paddingBottom: CARD_PAD,
    },
    ".cm-md-code-header": {
      backgroundColor: "var(--muted)",
      borderTopLeftRadius: CARD_RADIUS,
      borderTopRightRadius: CARD_RADIUS,
      paddingTop: "0.25rem",
    },
    ".cm-md-code-footer": {
      height: CARD_PAD,
      backgroundColor: "var(--muted)",
      borderBottomLeftRadius: CARD_RADIUS,
      borderBottomRightRadius: CARD_RADIUS,
    },
  }),
];
