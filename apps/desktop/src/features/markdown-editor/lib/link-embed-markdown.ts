import type { SyntaxNode } from "@lezer/common";
import { isWebUrl } from "../../../shared/lib/web-url";
import { linkHref } from "./link-clicks";
import { standsAlone, type Span, type TextSlice } from "./markdown-rules";

const EMBED_TITLE = "embed";
export const EMBED_URL_PLACEHOLDER = "url";

export const linkEmbedMarkdown = (url: string) => `[](${url} "${EMBED_TITLE}")`;

export interface MarkdownLinkEmbed {
  from: number;
  to: number;
  urlFrom: number;
  urlTo: number;
  url: string;
  label: string;
}

export function readLinkEmbed(node: SyntaxNode, slice: TextSlice, scope: Span): MarkdownLinkEmbed | null {
  const [open, close] = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  const title = node.getChild("LinkTitle");
  if (!open || !close || !url || !title || slice(title.from + 1, title.to - 1) !== EMBED_TITLE) return null;
  const href = linkHref(slice(url.from, url.to));
  if (!isWebUrl(href) || !standsAlone(slice, scope, node)) return null;
  return {
    from: node.from,
    to: node.to,
    urlFrom: url.from,
    urlTo: url.to,
    url: href,
    label: slice(open.to, close.from).trim(),
  };
}
