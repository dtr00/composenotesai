import type { EditorState, Line, Range } from "@codemirror/state";
import { Decoration, EditorView, type WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { EMBED_CONTROL } from "../ui/embed-menu";
import { standsAlone } from "./markdown-rules";
import { outermostNodes } from "./markdown-syntax";
import { ReactWidget } from "./widget-roots";

export interface EmbedSpan {
  from: number;
  to: number;
}

const CODE = new Set(["FencedCode"]);

export const embedNodes = <T extends EmbedSpan>(
  state: EditorState,
  name: string,
  read: (node: SyntaxNode) => T | null,
) => outermostNodes(state, (type) => type === name, CODE).flatMap((node) => read(node) ?? []);

export const standsAloneIn = (state: EditorState, span: EmbedSpan) =>
  standsAlone((from, to) => state.sliceDoc(from, to), state.doc.lineAt(span.from), span);

export const isSpanSelected = (state: EditorState, span: EmbedSpan) =>
  state.selection.ranges.some((range) => !range.empty && range.from <= span.from && range.to >= span.to);

export const blockDecoration = (widget: WidgetType, line: Line, editing: boolean): Range<Decoration> =>
  editing
    ? Decoration.widget({ widget, block: true, side: 1 }).range(line.to)
    : Decoration.replace({ widget, block: true }).range(line.from, line.to);

export function removeEmbed(view: EditorView, span: EmbedSpan, wholeLine: boolean) {
  const { doc } = view.state;
  const line = doc.lineAt(span.from);
  const from = wholeLine ? (line.to < doc.length ? line.from : Math.max(0, line.from - 1)) : span.from;
  const to = wholeLine ? Math.min(doc.length, line.to + 1) : span.to;
  view.dispatch({ changes: { from, to }, userEvent: "delete" });
  view.focus();
}

export abstract class EmbedWidget extends ReactWidget {
  ignoreEvent(event: Event) {
    return event.target instanceof Element && event.target.closest(EMBED_CONTROL) !== null;
  }
}

export const embedTheme = (className: string) =>
  EditorView.theme({
    [`.${className}`]: { userSelect: "none" },
    [`.${className} *::selection`]: { backgroundColor: "transparent" },
  });
