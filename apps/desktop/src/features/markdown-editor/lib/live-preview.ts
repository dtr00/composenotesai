import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import { createElement } from "react";
import { TaskCheckbox } from "../ui/task-checkbox";
import { codeBlocks } from "./code-blocks";
import { codeHighlight } from "./code-highlight";
import { codeParserFor } from "./code-languages";
import { dividerBlocks } from "./divider-blocks";
import { linkEmbeds } from "./link-embeds";
import { mathBlocks } from "./math-blocks";
import { mediaEmbeds } from "./media-embeds";
import { LINK_CLASS, linkClicks, linkHref, MISSING_LINK_CLASS } from "./link-clicks";
import { listWrapping } from "./list-wrapping";
import { splitWikiLink } from "../../../shared/lib/wiki-link-syntax";
import { NOTE_MARKDOWN } from "./note-markdown";
import { titleKey } from "../../../entities/note/model/note-tree";
import { noteTitles, noteTitleTracking } from "./note-titles";
import { selectedLineNumbers } from "./markdown-syntax";
import { UNDERLINE_CLOSE, UNDERLINE_OPEN } from "../../../shared/lib/markdown-extensions";
import { isShortSetext, isStarRule, listDepth, type TextSlice } from "./markdown-rules";
import { MONO } from "./monospace";
import { tableEditing } from "./table-widgets";
import { ReactWidget } from "./widget-roots";

const FIRST_LINE_CLASSES: Record<string, string> = {
  ATXHeading1: "cm-md-h1",
  ATXHeading2: "cm-md-h2",
  ATXHeading3: "cm-md-h3",
  ATXHeading4: "cm-md-h4",
  ATXHeading5: "cm-md-h4",
  ATXHeading6: "cm-md-h4",
  SetextHeading1: "cm-md-h1",
  SetextHeading2: "cm-md-h2",
  HorizontalRule: "cm-md-hr",
};

const EVERY_LINE_CLASSES: Record<string, string> = {
  CodeBlock: "cm-md-codeblock",
  Blockquote: "cm-md-quote",
  Table: "cm-md-table",
};

const INLINE_STYLES: Record<string, string> = {
  Emphasis: "cm-md-em",
  StrongEmphasis: "cm-md-strong",
  Strikethrough: "cm-md-strike",
  InlineCode: "cm-md-code",
};

const LINK_PARENTS = new Set(["Link", "Autolink"]);

class BulletWidget extends WidgetType {
  constructor(readonly glyph: string) {
    super();
  }

  eq(other: BulletWidget) {
    return other.glyph === this.glyph;
  }

  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "cm-md-bullet";
    bullet.textContent = this.glyph;
    return bullet;
  }
}

function toggleTask(view: EditorView, dom: HTMLElement) {
  const mark = view.posAtDOM(dom) + 1;
  const checked = view.state.sliceDoc(mark, mark + 1).toLowerCase() === "x";
  view.dispatch({ changes: { from: mark, to: mark + 1, insert: checked ? " " : "x" } });
}

class CheckboxWidget extends ReactWidget {
  protected readonly tag = "span";
  protected readonly className = "cm-md-checkbox";

  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  ignoreEvent() {
    return true;
  }

  protected element(view: EditorView, dom: HTMLElement) {
    return createElement(TaskCheckbox, {
      checked: this.checked,
      disabled: view.state.readOnly,
      onToggle: () => toggleTask(view, dom),
    });
  }
}

const hide = Decoration.replace({});
const underlined = Decoration.mark({ class: "cm-md-underline" });
const BULLETS = ["•", "◦", "▪"].map((glyph) => Decoration.replace({ widget: new BulletWidget(glyph) }));

type Concealer = (node: SyntaxNodeRef, state: EditorState) => Range<Decoration> | null;

const parentName = (node: SyntaxNodeRef) => node.node.parent?.name;

const hideNode = (node: SyntaxNodeRef) => hide.range(node.from, node.to);

const hideWithSpace: Concealer = (node, state) =>
  hide.range(node.from, state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to);

const hideInLink: Concealer = (node) => (LINK_PARENTS.has(parentName(node) ?? "") ? hideNode(node) : null);

function linkMark(node: SyntaxNodeRef, state: EditorState): Range<Decoration> | null {
  const mark = (from: number, to: number, url: { from: number; to: number }) =>
    from < to
      ? Decoration.mark({
          class: LINK_CLASS,
          attributes: { "data-href": linkHref(state.sliceDoc(url.from, url.to)) },
        }).range(from, to)
      : null;
  if (node.name === "WikiLink") return wikiLinkMark(node, state);
  if (node.name === "Link") {
    const [open, close] = node.node.getChildren("LinkMark");
    const url = node.node.getChild("URL");
    return open && close && url ? mark(open.to, close.from, url) : null;
  }
  const parent = parentName(node);
  return node.name === "URL" && parent !== "Link" && parent !== "Image" ? mark(node.from, node.to, node) : null;
}

function wikiTarget(node: SyntaxNodeRef, state: EditorState) {
  const [open, close] = node.node.getChildren("WikiLinkMark");
  return open && close ? { ...splitWikiLink(state.sliceDoc(open.to, close.from), open.to), open, close } : null;
}

function wikiLinkMark(node: SyntaxNodeRef, state: EditorState) {
  const target = wikiTarget(node, state);
  if (!target || target.labelFrom >= target.close.from) return null;
  const missing = !state.field(noteTitles).has(titleKey(target.title));
  return Decoration.mark({
    class: missing ? `${LINK_CLASS} ${MISSING_LINK_CLASS}` : LINK_CLASS,
    attributes: { "data-wiki": target.title },
  }).range(target.labelFrom, target.close.from);
}

const concealWikiAlias: Concealer = (node, state) => {
  const target = wikiTarget(node, state);
  return target && target.labelFrom > target.open.to ? hide.range(target.open.to, target.labelFrom) : null;
};

function concealListMark(node: SyntaxNodeRef): Range<Decoration> | null {
  const item = node.node.parent;
  const task = item?.getChild("Task");
  if (task) return hide.range(node.from, Math.min(task.from, node.to + 1));
  const list = item?.parent;
  return list?.name === "BulletList" ? BULLETS[listDepth(list) % BULLETS.length].range(node.from, node.to) : null;
}

function concealTaskMarker(node: SyntaxNodeRef, state: EditorState) {
  const checked = state.sliceDoc(node.from + 1, node.from + 2).toLowerCase() === "x";
  return Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to);
}

const CONCEALERS: Record<string, Concealer> = {
  HeaderMark: hideWithSpace,
  QuoteMark: hideWithSpace,
  EmphasisMark: hideNode,
  StrikethroughMark: hideNode,
  CodeMark: (node) => (parentName(node) === "FencedCode" ? null : hideNode(node)),
  LinkMark: hideInLink,
  URL: hideInLink,
  LinkTitle: hideInLink,
  WikiLink: concealWikiAlias,
  WikiLinkMark: hideNode,
  HorizontalRule: (node, state) => (isStarRule(node.node, sliceOf(state)) ? null : hideNode(node)),
  ListMark: concealListMark,
  TaskMarker: concealTaskMarker,
};

const sliceOf =
  (state: EditorState): TextSlice =>
  (from, to) =>
    state.sliceDoc(from, to);

const editingLines = (state: EditorState, focused: boolean) => new Set(focused ? selectedLineNumbers(state) : []);

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  const editing = editingLines(state, view.hasFocus);
  const isEditing = (pos: number) => editing.has(state.doc.lineAt(pos).number);
  const decorations: Range<Decoration>[] = [];
  const lineClass = (pos: number, className: string) =>
    decorations.push(Decoration.line({ class: className }).range(state.doc.lineAt(pos).from));
  const eachLine = (from: number, to: number, className: string) => {
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      lineClass(line.from, className);
      pos = line.to + 1;
    }
  };

  const style = (node: SyntaxNodeRef) => {
    const { name, from, to } = node;
    const slice = sliceOf(state);
    if (FIRST_LINE_CLASSES[name] && !isShortSetext(node.node, slice) && !isStarRule(node.node, slice))
      lineClass(from, FIRST_LINE_CLASSES[name]);
    if (EVERY_LINE_CLASSES[name]) eachLine(from, to, EVERY_LINE_CLASSES[name]);
    if (INLINE_STYLES[name] && from < to)
      decorations.push(Decoration.mark({ class: INLINE_STYLES[name] }).range(from, to));
  };
  const link = (node: SyntaxNodeRef) => {
    const marked = linkMark(node, state);
    if (marked) decorations.push(marked);
  };
  const conceal = (node: SyntaxNodeRef) => {
    const hidden = isEditing(node.from) ? null : CONCEALERS[node.name]?.(node, state);
    if (hidden && hidden.from < hidden.to) decorations.push(hidden);
  };

  let underlineOpen: { from: number; to: number } | null = null;
  const underline = (node: SyntaxNodeRef) => {
    if (node.name !== "HTMLTag") return;
    const tag = state.sliceDoc(node.from, node.to).toLowerCase();
    if (tag === UNDERLINE_OPEN) underlineOpen = { from: node.from, to: node.to };
    if (tag !== UNDERLINE_CLOSE || !underlineOpen) return;
    if (underlineOpen.to < node.from) decorations.push(underlined.range(underlineOpen.to, node.from));
    for (const tagNode of [underlineOpen, node]) {
      if (!isEditing(tagNode.from)) decorations.push(hide.range(tagNode.from, tagNode.to));
    }
    underlineOpen = null;
  };

  for (const { from, to } of view.visibleRanges) {
    underlineOpen = null;
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "FencedCode") return false;
        style(node);
        link(node);
        conceal(node);
        underline(node);
      },
    });
  }
  return Decoration.set(decorations, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }

    update(update: ViewUpdate) {
      const titlesChanged = update.startState.field(noteTitles) !== update.state.field(noteTitles);
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged || titlesChanged) {
        this.decorations = decorate(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const livePreviewTheme = EditorView.theme({
  "&": { fontSize: "inherit", color: "inherit", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.6", overflow: "hidden" },
  ".cm-content": { padding: "0", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-md-h1": { fontSize: "1.6em", fontWeight: "650", lineHeight: "1.3", paddingTop: "0.4em" },
  ".cm-md-h2": { fontSize: "1.35em", fontWeight: "650", lineHeight: "1.35", paddingTop: "0.3em" },
  ".cm-md-h3": { fontSize: "1.15em", fontWeight: "600", paddingTop: "0.2em" },
  ".cm-md-h4": { fontWeight: "600" },
  ".cm-md-em": { fontStyle: "italic" },
  ".cm-md-strong": { fontWeight: "650" },
  ".cm-md-underline": { textDecoration: "underline", textUnderlineOffset: "3px" },
  ".cm-md-strike": { textDecoration: "line-through", color: "var(--muted-foreground)" },
  ".cm-md-code": {
    fontFamily: MONO,
    fontSize: "0.875em",
    color: "var(--primary)",
    backgroundColor: "color-mix(in oklab, var(--primary) 24%, transparent)",
    borderRadius: "4px",
    padding: "0.1em 0.3em",
  },
  [`.${LINK_CLASS}`]: {
    color: "var(--primary)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    textDecorationColor: "color-mix(in oklab, var(--primary) 50%, transparent)",
    cursor: "pointer",
  },
  [`.${MISSING_LINK_CLASS}`]: {
    color: "var(--muted-foreground)",
    textDecorationStyle: "dashed",
    textDecorationColor: "var(--muted-foreground)",
  },
  ".cm-md-codeblock": { fontFamily: MONO, fontSize: "0.875em", backgroundColor: "var(--muted)", padding: "0 0.75em" },
  ".cm-md-quote": { borderLeft: "3px solid var(--border)", paddingLeft: "0.9em", color: "var(--muted-foreground)" },
  ".cm-md-table": { fontFamily: MONO, fontSize: "0.875em" },
  ".cm-md-hr": {
    background: "linear-gradient(var(--border), var(--border)) left 52% / 100% 1px no-repeat",
    color: "var(--muted-foreground)",
  },
  ".cm-md-bullet": { color: "var(--muted-foreground)", padding: "0 0.15em" },
  ".cm-md-checkbox": {
    display: "inline-flex",
    margin: "0 0.5em 0 0",
    verticalAlign: "-0.15em",
  },
});

export const liveMarkdown = [
  markdown({
    ...NOTE_MARKDOWN,
    codeLanguages: codeParserFor,
    addKeymap: false,
    completeHTMLTags: false,
  }),
  codeHighlight,
  codeBlocks,
  EditorView.lineWrapping,
  livePreviewPlugin,
  livePreviewTheme,
  mediaEmbeds,
  linkEmbeds,
  mathBlocks,
  tableEditing,
  dividerBlocks,
  linkClicks,
  listWrapping,
  noteTitleTracking,
];
