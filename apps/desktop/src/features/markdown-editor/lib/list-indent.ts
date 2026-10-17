import { ensureSyntaxTree } from "@codemirror/language";
import { Prec, type ChangeSpec, type EditorState, type Text } from "@codemirror/state";
import { keymap, type EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { selectedLineNumbers } from "./markdown-syntax";

const LIST_ITEM = /^( *)([-*+]|(\d+)([.)]))( +|$)/;
const PARSE_TIMEOUT_MS = 200;

interface ListItem {
  line: number;
  indent: number;
  content: number;
  number: number | null;
  delimiter: string;
  markerEnd: number;
}

function itemAt(doc: Text, number: number): ListItem | null {
  const line = doc.line(number);
  const match = LIST_ITEM.exec(line.text);
  if (!match) return null;
  const [whole, indent, marker, digits, delimiter = ""] = match;
  return {
    line: number,
    indent: indent.length,
    content: whole.length === indent.length + marker.length ? whole.length + 1 : whole.length,
    number: digits === undefined ? null : Number(digits),
    delimiter,
    markerEnd: line.from + indent.length + marker.length,
  };
}

const indentOf = (text: string) => text.length - text.trimStart().length;
const isBlank = (doc: Text, number: number) => doc.line(number).text.trim() === "";

function lastLineOf(doc: Text, item: ListItem) {
  let last = item.line;
  for (let number = item.line + 1; number <= doc.lines; number++) {
    if (isBlank(doc, number)) continue;
    if (indentOf(doc.line(number).text) <= item.indent) break;
    last = number;
  }
  return last;
}

function previousSibling(doc: Text, item: ListItem) {
  for (let number = item.line - 1; number >= 1; number--) {
    if (isBlank(doc, number)) continue;
    const indent = indentOf(doc.line(number).text);
    if (indent < item.indent) return null;
    if (indent === item.indent) return itemAt(doc, number);
  }
  return null;
}

function parentOf(doc: Text, item: ListItem) {
  for (let number = item.line - 1; number >= 1; number--) {
    if (isBlank(doc, number)) continue;
    const candidate = itemAt(doc, number);
    if (candidate && candidate.indent < item.indent) return candidate;
    if (!candidate && indentOf(doc.line(number).text) === 0) return null;
  }
  return null;
}

function lastChildNumber(doc: Text, parent: ListItem, before: number, indent: number) {
  let found: number | null = null;
  for (let number = parent.line + 1; number < before; number++) {
    const child = itemAt(doc, number);
    if (child?.indent === indent) found = child.number;
  }
  return found;
}

function shiftLines(doc: Text, item: ListItem, delta: number): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  for (let number = item.line; number <= lastLineOf(doc, item); number++) {
    const line = doc.line(number);
    if (line.text.trim() === "") continue;
    if (delta > 0) changes.push({ from: line.from, insert: " ".repeat(delta) });
    else changes.push({ from: line.from, to: line.from + Math.min(-delta, indentOf(line.text)) });
  }
  return changes;
}

function renumber(item: ListItem, doc: Text, number: number): ChangeSpec[] {
  if (item.number === null || item.number === number) return [];
  const from = doc.line(item.line).from + item.indent;
  return [{ from, to: item.markerEnd - item.delimiter.length, insert: String(number) }];
}

function moveItem(doc: Text, item: ListItem, deeper: boolean): ChangeSpec[] | null {
  if (deeper) {
    const sibling = previousSibling(doc, item);
    if (!sibling) return null;
    const indent = sibling.indent + sibling.content;
    const previous = lastChildNumber(doc, sibling, item.line, indent);
    return [...shiftLines(doc, item, indent - item.indent), ...renumber(item, doc, (previous ?? 0) + 1)];
  }
  const parent = parentOf(doc, item);
  if (!parent) return null;
  const number = parent.number === null ? 1 : parent.number + 1;
  return [...shiftLines(doc, item, parent.indent - item.indent), ...renumber(item, doc, number)];
}

function orderedListsAround(state: EditorState, positions: number[]) {
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_TIMEOUT_MS);
  const lists = new Map<number, SyntaxNode>();
  for (const pos of positions) {
    for (let node: SyntaxNode | null = tree?.resolveInner(pos, 1) ?? null; node; node = node.parent) {
      if (node.name === "OrderedList") lists.set(node.from, node);
    }
  }
  return [...lists.values()];
}

function sequentialNumbers(state: EditorState, positions: number[]): ChangeSpec[] {
  return orderedListsAround(state, positions).flatMap((list) => {
    const marks = list.getChildren("ListItem").flatMap((entry) => entry.getChild("ListMark") ?? []);
    const first = Number.parseInt(state.sliceDoc(marks[0]?.from, marks[0]?.to), 10);
    if (Number.isNaN(first)) return [];
    return marks.flatMap((mark, index) => {
      const digits = /^\d+/.exec(state.sliceDoc(mark.from, mark.to))?.[0] ?? "";
      const wanted = String(first + index);
      return digits === wanted ? [] : [{ from: mark.from, to: mark.from + digits.length, insert: wanted }];
    });
  });
}

function selectedItems(state: EditorState) {
  const { doc } = state;
  const items: ListItem[] = [];
  let coveredUntil = 0;
  for (const number of selectedLineNumbers(state)) {
    const item = number > coveredUntil ? itemAt(doc, number) : null;
    if (!item) continue;
    items.push(item);
    coveredUntil = lastLineOf(doc, item);
  }
  return items;
}

const moveListItems = (deeper: boolean) => (view: EditorView) => {
  const { state } = view;
  if (state.readOnly) return false;
  const items = selectedItems(state);
  if (items.length === 0) return false;
  const moves = items.map((item) => moveItem(state.doc, item, deeper));
  const changes = state.changes(moves.flatMap((move) => move ?? []));
  if (changes.empty) return true;
  const moved = state.update({ changes }).state;
  const touched = items.map((item) => changes.mapPos(state.doc.line(item.line).from, 1));
  const numbering = moved.changes(sequentialNumbers(moved, touched));
  view.dispatch({
    changes: changes.compose(numbering),
    selection: state.selection.map(changes.compose(numbering)),
    userEvent: deeper ? "input.indent" : "delete.dedent",
  });
  return true;
};

export const listIndent = Prec.high(
  keymap.of([
    { key: "Tab", run: moveListItems(true) },
    { key: "Shift-Tab", run: moveListItems(false) },
  ]),
);
