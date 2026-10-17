import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { createElement } from "react";
import { DocumentEmbed } from "../ui/document-embed";
import { MediaEmbed } from "../ui/media-embed";
import {
  blockDecoration,
  embedNodes,
  embedTheme,
  EmbedWidget,
  isSpanSelected,
  removeEmbed,
  standsAloneIn,
} from "./block-embeds";
import { nodeAt, perParse, selectionTouches } from "./markdown-syntax";
import { decorationField, isEditable } from "./widget-roots";
import {
  formatMediaAlt,
  localMediaId,
  mediaTypeOfUrl,
  mediaUrl,
  readMedia,
  type MarkdownMedia,
  type MediaAlt,
} from "./media-markdown";

const readStateMedia = (state: EditorState, node: SyntaxNode) =>
  readMedia(node, (from, to) => state.sliceDoc(from, to));

const mediaIn = perParse((state) => embedNodes(state, "Image", (node) => readStateMedia(state, node)));

function mediaAt(view: EditorView, dom: HTMLElement): MarkdownMedia | null {
  const pos = view.posAtDOM(dom);
  const node = nodeAt(view.state, pos, "Image");
  return node ? readStateMedia(view.state, node) : null;
}

function resizeMedia(view: EditorView, dom: HTMLElement, width: number | null) {
  const media = mediaAt(view, dom);
  if (!media) return;
  const insert = formatMediaAlt({ text: media.alt.text, width });
  view.dispatch({ changes: { from: media.altFrom, to: media.altTo, insert }, userEvent: "input" });
}

function removeMedia(view: EditorView, dom: HTMLElement) {
  const media = mediaAt(view, dom);
  if (media) removeEmbed(view, media, standsAloneIn(view.state, media));
}

class MediaWidget extends EmbedWidget {
  protected readonly className = "cm-md-media";

  constructor(
    readonly url: string,
    readonly alt: MediaAlt,
    readonly block: boolean,
    readonly editable: boolean,
    readonly selected: boolean,
  ) {
    super();
  }

  protected get tag() {
    return this.block ? "div" : "span";
  }

  eq(other: MediaWidget) {
    return (
      other.url === this.url &&
      other.alt.text === this.alt.text &&
      other.alt.width === this.alt.width &&
      other.block === this.block &&
      other.editable === this.editable &&
      other.selected === this.selected
    );
  }

  protected element(view: EditorView, dom: HTMLElement) {
    const mediaType = mediaTypeOfUrl(this.url);
    const shared = {
      key: this.url,
      mediaId: localMediaId(this.url),
      alt: this.alt.text,
      block: this.block,
      editable: this.editable,
      selected: this.selected,
      onLayout: () => view.requestMeasure(),
      onRemove: () => removeMedia(view, dom),
    };
    if (mediaType === "document") return createElement(DocumentEmbed, shared);
    return createElement(MediaEmbed, {
      ...shared,
      src: mediaUrl(this.url),
      mediaType,
      width: this.alt.width,
      onResize: (width) => resizeMedia(view, dom, width),
    });
  }
}

function embeds(state: EditorState): DecorationSet {
  const editable = isEditable(state);
  const decorations: Range<Decoration>[] = [];
  for (const media of mediaIn(state)) {
    const line = state.doc.lineAt(media.from);
    const block = standsAloneIn(state, media);
    const editing = editable && selectionTouches(state, block ? line.from : media.from, block ? line.to : media.to);
    const widget = new MediaWidget(media.url, media.alt, block, editable, isSpanSelected(state, media));
    if (block) decorations.push(blockDecoration(widget, line, editing));
    else if (!editing) decorations.push(Decoration.replace({ widget }).range(media.from, media.to));
  }
  return Decoration.set(decorations, true);
}

const embedField = decorationField(embeds, { followSelection: true });

export const mediaEmbeds = [embedField, embedTheme("cm-md-media")];
