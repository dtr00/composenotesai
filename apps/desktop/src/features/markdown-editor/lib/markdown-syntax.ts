import { syntaxTree } from "@codemirror/language";
import type { EditorState, Text } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";

const CODE_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText"]);
const NOTHING_SKIPPED: ReadonlySet<string> = new Set();

export function outermostNodes(
  state: EditorState,
  matches: (name: string) => boolean,
  skipped = NOTHING_SKIPPED,
): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (skipped.has(node.name)) return false;
      if (!matches(node.name)) return;
      found.push(node.node);
      return false;
    },
  });
  return found;
}

export function perParse<T>(read: (state: EditorState) => T): (state: EditorState) => T {
  let cached: { tree: Tree; doc: Text; value: T } | null = null;
  return (state) => {
    const tree = syntaxTree(state);
    if (cached?.tree !== tree || cached.doc !== state.doc) cached = { tree, doc: state.doc, value: read(state) };
    return cached.value;
  };
}

export function ancestor(
  state: EditorState,
  pos: number,
  side: -1 | 1,
  test: (node: SyntaxNode) => boolean,
): SyntaxNode | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) {
    if (test(node)) return node;
  }
  return null;
}

export const insideCode = (state: EditorState, pos: number) =>
  ancestor(state, pos, -1, (node) => CODE_NODES.has(node.name)) !== null;

export function selectedLineNumbers(state: EditorState): number[] {
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const last = state.doc.lineAt(range.to).number;
    for (let line = state.doc.lineAt(range.from).number; line <= last; line++) numbers.add(line);
  }
  return [...numbers].sort((a, b) => a - b);
}

export const selectionTouches = (state: EditorState, from: number, to: number) =>
  state.selection.ranges.some((range) => range.from <= to && range.to >= from);

const named = (name: string) => (node: SyntaxNode) => node.name === name;

export const nodeAt = (state: EditorState, pos: number, name: string) =>
  ancestor(state, pos, 1, named(name)) ?? ancestor(state, pos, -1, named(name));
