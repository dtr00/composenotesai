import type { SyntaxNode } from "@lezer/common";

export type TextSlice = (from: number, to: number) => string;

export interface Span {
  from: number;
  to: number;
}

const LISTS = new Set(["BulletList", "OrderedList"]);
const SETEXT_HEADINGS = new Set(["SetextHeading1", "SetextHeading2"]);
const DASH_RULE = /^[\s-]+$/;

export function listDepth(list: SyntaxNode) {
  let depth = 0;
  for (let node = list.parent; node; node = node.parent) if (LISTS.has(node.name)) depth++;
  return depth;
}

export function isShortSetext(heading: SyntaxNode, slice: TextSlice) {
  const mark = SETEXT_HEADINGS.has(heading.name) ? heading.getChild("HeaderMark") : null;
  return mark !== null && slice(mark.from, mark.to).trim().length < 2;
}

export const isStarRule = (node: SyntaxNode, slice: TextSlice) =>
  node.name === "HorizontalRule" && !DASH_RULE.test(slice(node.from, node.to));

export function standsAlone(slice: TextSlice, scope: Span, inner: Span) {
  const before = slice(scope.from, inner.from);
  const after = slice(inner.to, scope.to);
  return before.slice(before.lastIndexOf("\n") + 1).trim() === "" && after.split("\n", 1)[0].trim() === "";
}
