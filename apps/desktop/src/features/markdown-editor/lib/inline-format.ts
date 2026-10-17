import { EditorSelection, Prec, type ChangeSpec, type EditorState, type SelectionRange } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { ancestor } from "./markdown-syntax";
import { UNDERLINE_CLOSE, UNDERLINE_OPEN } from "../../../shared/lib/markdown-extensions";

export interface InlineFormat {
  open: string;
  close: string;
  node?: { name: string; mark: string };
}

export const BOLD: InlineFormat = { open: "**", close: "**", node: { name: "StrongEmphasis", mark: "EmphasisMark" } };
export const ITALIC: InlineFormat = { open: "*", close: "*", node: { name: "Emphasis", mark: "EmphasisMark" } };
export const UNDERLINE: InlineFormat = { open: UNDERLINE_OPEN, close: UNDERLINE_CLOSE };
export const STRIKETHROUGH: InlineFormat = {
  open: "~~",
  close: "~~",
  node: { name: "Strikethrough", mark: "StrikethroughMark" },
};
export const CODE: InlineFormat = { open: "`", close: "`", node: { name: "InlineCode", mark: "CodeMark" } };

const LINK_URL = "url";

interface Span {
  from: number;
  to: number;
  inner: { from: number; to: number };
}

const enclosing = (state: EditorState, range: SelectionRange, name: string) =>
  ancestor(state, range.from, 1, (node) => node.name === name && node.from <= range.from && node.to >= range.to);

function enclosingNode(state: EditorState, range: SelectionRange, { name, mark }: { name: string; mark: string }) {
  const node = enclosing(state, range, name);
  if (node) {
    const marks = node.getChildren(mark);
    const first = marks[0];
    const last = marks[marks.length - 1];
    if (first && first !== last) return { from: node.from, to: node.to, inner: { from: first.to, to: last.from } };
  }
  return null;
}

function enclosingTags(state: EditorState, range: SelectionRange, { open, close }: InlineFormat): Span | null {
  const line = state.doc.lineAt(range.from);
  if (range.to > line.to) return null;
  const before = state.sliceDoc(line.from, range.from);
  const after = state.sliceDoc(range.to, line.to);
  const opened = before.lastIndexOf(open);
  const closed = after.indexOf(close);
  if (opened === -1 || closed === -1 || before.lastIndexOf(close) > opened) return null;
  const selected = state.sliceDoc(range.from, range.to);
  if (selected.includes(open) || selected.includes(close) || after.slice(0, closed).includes(open)) return null;
  const from = line.from + opened;
  const to = range.to + closed + close.length;
  return { from, to, inner: { from: from + open.length, to: to - close.length } };
}

function selectedTags(state: EditorState, range: SelectionRange, { open, close }: InlineFormat): Span | null {
  const text = state.sliceDoc(range.from, range.to);
  if (text.length < open.length + close.length || !text.startsWith(open) || !text.endsWith(close)) return null;
  return { from: range.from, to: range.to, inner: { from: range.from + open.length, to: range.to - close.length } };
}

function emptyPair(state: EditorState, range: SelectionRange, { open, close }: InlineFormat): Span | null {
  if (!range.empty) return null;
  const from = range.from - open.length;
  const to = range.to + close.length;
  if (from < 0 || to > state.doc.length) return null;
  const bare = state.sliceDoc(from - 1, from) !== open[0] && state.sliceDoc(to, to + 1) !== close[close.length - 1];
  if (!bare || state.sliceDoc(from, range.from) !== open || state.sliceDoc(range.to, to) !== close) return null;
  return { from, to, inner: { from: range.from, to: range.to } };
}

const existingSpan = (state: EditorState, range: SelectionRange, format: InlineFormat) =>
  emptyPair(state, range, format) ??
  (format.node
    ? enclosingNode(state, range, format.node)
    : (selectedTags(state, range, format) ?? enclosingTags(state, range, format)));

function toggleRange(state: EditorState, range: SelectionRange, format: InlineFormat) {
  const { open, close } = format;
  const span = existingSpan(state, range, format);
  if (span && range.empty && range.head === span.inner.to && span.inner.from < span.inner.to) {
    return { range: EditorSelection.cursor(span.to) };
  }
  if (span) {
    const changes: ChangeSpec[] = [
      { from: span.from, to: span.inner.from },
      { from: span.inner.to, to: span.to },
    ];
    const shift = (pos: number) =>
      Math.min(Math.max(pos, span.inner.from), span.inner.to) - (span.inner.from - span.from);
    return { changes, range: EditorSelection.range(shift(range.anchor), shift(range.head)) };
  }
  const changes: ChangeSpec[] = [
    { from: range.from, insert: open },
    { from: range.to, insert: close },
  ];
  return { changes, range: EditorSelection.range(range.anchor + open.length, range.head + open.length) };
}

export const isFormatted = (state: EditorState, format: InlineFormat) => {
  const range = state.selection.main;
  return !range.empty && existingSpan(state, range, format) !== null;
};

export const toggleFormat = (format: InlineFormat) => (view: EditorView) => {
  if (view.state.readOnly) return false;
  view.dispatch(
    view.state.changeByRange((range) => toggleRange(view.state, range, format)),
    { userEvent: "input.format", scrollIntoView: true },
  );
  return true;
};

export const isLinked = (state: EditorState) => enclosing(state, state.selection.main, "Link") !== null;

export function toggleLink(view: EditorView) {
  const { state } = view;
  if (state.readOnly) return false;
  const range = state.selection.main;
  const link = enclosing(state, range, "Link");
  const [open, close] = link?.getChildren("LinkMark") ?? [];
  if (link && open && close) {
    const text = state.sliceDoc(open.to, close.from);
    view.dispatch({
      changes: { from: link.from, to: link.to, insert: text },
      selection: { anchor: link.from, head: link.from + text.length },
      userEvent: "input.format",
    });
    return true;
  }
  const urlFrom = range.to + 3;
  view.dispatch({
    changes: [
      { from: range.from, insert: "[" },
      { from: range.to, insert: `](${LINK_URL})` },
    ],
    selection: { anchor: urlFrom, head: urlFrom + LINK_URL.length },
    userEvent: "input.format",
  });
  return true;
}

const TRAILING_CLOSERS = /^(?:\*\*|\*|_|~~|`|<\/u>)+$/;

function leaveClosingMarkers(view: EditorView) {
  const range = view.state.selection.main;
  if (!range.empty || view.state.selection.ranges.length > 1) return false;
  const line = view.state.doc.lineAt(range.head);
  if (!TRAILING_CLOSERS.test(view.state.sliceDoc(range.head, line.to))) return false;
  view.dispatch({ selection: { anchor: line.to } });
  return false;
}

const BRACKET_PAIRS: Record<string, [string, string]> = {
  "[": ["[", "]"],
  "]": ["[", "]"],
  "(": ["(", ")"],
  ")": ["(", ")"],
  "{": ["{", "}"],
  "}": ["{", "}"],
};

const surroundSelection = EditorView.inputHandler.of((view, _from, _to, text) => {
  const pair = BRACKET_PAIRS[text];
  const { state } = view;
  if (!pair || state.readOnly || state.selection.ranges.some((range) => range.empty)) return false;
  const [open, close] = pair;
  view.dispatch(
    state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: open },
        { from: range.to, insert: close },
      ],
      range: EditorSelection.range(range.anchor + open.length, range.head + open.length),
    })),
    { userEvent: "input.type", scrollIntoView: true },
  );
  return true;
});

export const inlineFormatting = [Prec.high(keymap.of([{ key: "Enter", run: leaveClosingMarkers }])), surroundSelection];
