import { type ChangeSpec, type EditorState, type Line } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { selectedLineNumbers } from "./markdown-syntax";

const BLOCK_MARKUP = /^(\s*)(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;
const TASK = /^(\s*[-*+]\s+\[)([ xX])\]/;

export interface BlockMarkup {
  indent: string;
  markup: string;
  body: string;
}

export function splitBlockMarkup(text: string): BlockMarkup {
  const [whole, indent] = BLOCK_MARKUP.exec(text) ?? ["", ""];
  return { indent, markup: whole.slice(indent.length), body: text.slice(whole.length) };
}

function blockKind(markup: string) {
  const trimmed = markup.trim();
  if (/^#{1,6}$/.test(trimmed)) return trimmed;
  if (/^[-*+]\s+\[[ xX]\]$/.test(trimmed)) return "todo";
  if (/^[-*+]$/.test(trimmed)) return "bullet";
  if (/^\d+[.)]$/.test(trimmed)) return "number";
  return trimmed === ">" ? "quote" : "text";
}

const selectedLines = (state: EditorState): Line[] =>
  selectedLineNumbers(state).map((number) => state.doc.line(number));

export const setBlocks = (prefix: (index: number) => string) => (view: EditorView) => {
  if (view.state.readOnly) return false;
  const lines = selectedLines(view.state);
  const target = blockKind(prefix(0));
  const already = lines.every((line) => blockKind(splitBlockMarkup(line.text).markup) === target);
  const changes: ChangeSpec[] = lines.map((line, index) => {
    const { indent, markup } = splitBlockMarkup(line.text);
    const from = line.from + indent.length;
    return { from, to: from + markup.length, insert: already ? "" : prefix(index) };
  });
  view.dispatch({ changes, userEvent: "input.format" });
  return true;
};

export function toggleTasks(view: EditorView) {
  if (view.state.readOnly) return false;
  const changes: ChangeSpec[] = selectedLines(view.state).flatMap((line) => {
    const task = TASK.exec(line.text);
    if (!task) return [];
    const at = line.from + task[1].length;
    return [{ from: at, to: at + 1, insert: task[2] === " " ? "x" : " " }];
  });
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "input.format" });
  return true;
}

export const fixed = (prefix: string) => () => prefix;
