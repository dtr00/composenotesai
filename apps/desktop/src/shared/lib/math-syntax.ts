import { tags } from "@lezer/highlight";
import type { InlineContext, MarkdownConfig } from "@lezer/markdown";

const DOLLAR = 36;
const BACKSLASH = 92;

const isSpace = (char: number) => char === 32 || char === 9 || char === 10 || char === 13;
const isDigit = (char: number) => char >= 48 && char <= 57;

function pandocClosingDollar(cx: InlineContext, start: number, display: boolean): number {
  if (!display && (isSpace(cx.char(start)) || cx.char(start) === DOLLAR)) return -1;
  for (let at = start; at < cx.end; at++) {
    const char = cx.char(at);
    if (char === BACKSLASH) {
      at++;
      continue;
    }
    if (char !== DOLLAR || at === start) continue;
    if (display) {
      if (cx.char(at + 1) === DOLLAR) return at;
      continue;
    }
    if (!isSpace(cx.char(at - 1)) && !isDigit(cx.char(at + 1))) return at;
  }
  return -1;
}

export const mathSyntax: MarkdownConfig = {
  defineNodes: [
    { name: "InlineMath", style: tags.special(tags.content) },
    { name: "DisplayMath", style: tags.special(tags.content) },
    { name: "MathMark", style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: "Math",
      parse(cx, next, pos) {
        if (next !== DOLLAR) return -1;
        const display = cx.char(pos + 1) === DOLLAR;
        const mark = display ? 2 : 1;
        const close = pandocClosingDollar(cx, pos + mark, display);
        if (close < 0) return -1;
        const end = close + mark;
        return cx.addElement(
          cx.elt(display ? "DisplayMath" : "InlineMath", pos, end, [
            cx.elt("MathMark", pos, pos + mark),
            cx.elt("MathMark", close, end),
          ]),
        );
      },
    },
  ],
};

export const isMathNode = (name: string) => name === "InlineMath" || name === "DisplayMath";

export function mathSource(text: string, name: string, from: number, to: number) {
  const mark = name === "DisplayMath" ? 2 : 1;
  return text.slice(from + mark, to - mark).trim();
}
