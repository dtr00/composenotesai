import { tags } from "@lezer/highlight";
import type { MarkdownConfig } from "@lezer/markdown";

const OPEN_BRACKET = 91;
const CLOSE = "]]";
const TARGET = /^[^[\]\n]+$/;
const WHOLE_LINK = /^\[\[([^[\]\n]+)\]\]$/;

export interface WikiTarget {
  title: string;
  label: string;
  labelFrom: number;
}

export function splitWikiLink(inner: string, innerFrom: number): WikiTarget {
  const pipe = inner.indexOf("|");
  if (pipe === -1) return { title: inner.trim(), label: inner, labelFrom: innerFrom };
  return { title: inner.slice(0, pipe).trim(), label: inner.slice(pipe + 1), labelFrom: innerFrom + pipe + 1 };
}

export function parseWikiLink(text: string): WikiTarget | null {
  const inner = WHOLE_LINK.exec(text)?.[1];
  return inner === undefined ? null : splitWikiLink(inner, 2);
}

export const wikiLinkSyntax: MarkdownConfig = {
  defineNodes: [
    { name: "WikiLink", style: tags.link },
    { name: "WikiLinkMark", style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: "WikiLink",
      before: "Link",
      parse(cx, next, pos) {
        if (next !== OPEN_BRACKET || cx.char(pos + 1) !== OPEN_BRACKET) return -1;
        const rest = cx.slice(pos + 2, cx.end);
        const close = rest.indexOf(CLOSE);
        if (close <= 0 || !TARGET.test(rest.slice(0, close))) return -1;
        const end = pos + 2 + close + CLOSE.length;
        return cx.addElement(
          cx.elt("WikiLink", pos, end, [cx.elt("WikiLinkMark", pos, pos + 2), cx.elt("WikiLinkMark", end - 2, end)]),
        );
      },
    },
  ],
};
