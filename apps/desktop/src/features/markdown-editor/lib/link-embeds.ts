import type { EditorState, Range } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { createElement } from "react";
import { LinkEmbed } from "../ui/link-embed";
import { blockDecoration, embedNodes, embedTheme, EmbedWidget, isSpanSelected, removeEmbed } from "./block-embeds";
import { openLink } from "./link-clicks";
import { readLinkEmbed, type MarkdownLinkEmbed } from "./link-embed-markdown";
import { nodeAt, perParse, selectionTouches } from "./markdown-syntax";
import { previewFor } from "./page-previews";
import { decorationField, isEditable } from "./widget-roots";

const readEmbed = (state: EditorState, node: SyntaxNode) =>
  readLinkEmbed(node, (from, to) => state.sliceDoc(from, to), state.doc.lineAt(node.from));

function embedAt(view: EditorView, dom: HTMLElement): MarkdownLinkEmbed | null {
  const node = nodeAt(view.state, view.posAtDOM(dom), "Link");
  return node ? readEmbed(view.state, node) : null;
}

function editEmbed(view: EditorView, dom: HTMLElement) {
  const embed = embedAt(view, dom);
  if (!embed) return;
  view.dispatch({ selection: { anchor: embed.urlFrom, head: embed.urlTo }, scrollIntoView: true });
  view.focus();
}

function removeLinkEmbed(view: EditorView, dom: HTMLElement) {
  const embed = embedAt(view, dom);
  if (embed) removeEmbed(view, embed, true);
}

class LinkEmbedWidget extends EmbedWidget {
  protected readonly tag = "div";
  protected readonly className = "cm-md-link-embed";

  constructor(
    readonly url: string,
    readonly label: string,
    readonly editable: boolean,
    readonly selected: boolean,
  ) {
    super();
  }

  eq(other: LinkEmbedWidget) {
    return (
      other.url === this.url &&
      other.label === this.label &&
      other.editable === this.editable &&
      other.selected === this.selected
    );
  }

  protected element(view: EditorView, dom: HTMLElement) {
    return createElement(LinkEmbed, {
      key: this.url,
      url: this.url,
      label: this.label,
      preview: previewFor(this.url),
      editable: this.editable,
      selected: this.selected,
      onLayout: () => view.requestMeasure(),
      onOpen: (external) => openLink(view, this.url, external),
      onEdit: () => editEmbed(view, dom),
      onRemove: () => removeLinkEmbed(view, dom),
    });
  }
}

const linkEmbedsIn = perParse((state) => embedNodes(state, "Link", (node) => readEmbed(state, node)));

function embeds(state: EditorState): DecorationSet {
  const editable = isEditable(state);
  const decorations: Range<Decoration>[] = [];
  for (const embed of linkEmbedsIn(state)) {
    const line = state.doc.lineAt(embed.from);
    const editing = editable && selectionTouches(state, line.from, line.to);
    const widget = new LinkEmbedWidget(embed.url, embed.label, editable, isSpanSelected(state, embed));
    decorations.push(blockDecoration(widget, line, editing));
  }
  return Decoration.set(decorations, true);
}

export const linkEmbeds = [decorationField(embeds, { followSelection: true }), embedTheme("cm-md-link-embed")];
