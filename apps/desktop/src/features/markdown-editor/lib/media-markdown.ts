import type { SyntaxNode } from "@lezer/common";
import { mediaSource, type MediaSummary, type MediaType } from "../../../shared/api/notes";
import type { TextSlice } from "./markdown-rules";

const LOCAL_MEDIA = /^(image|video|document):(\d+)$/;
const SIZED_ALT = /^(.*)\|(\d+)$/;

export interface MediaAlt {
  text: string;
  width: number | null;
}

export function parseMediaAlt(alt: string): MediaAlt {
  const sized = SIZED_ALT.exec(alt);
  return sized ? { text: sized[1], width: Number(sized[2]) } : { text: alt, width: null };
}

export interface MarkdownMedia {
  from: number;
  to: number;
  altFrom: number;
  altTo: number;
  url: string;
  alt: MediaAlt;
}

export function readMedia(node: SyntaxNode, slice: TextSlice): MarkdownMedia | null {
  const [open, close] = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  if (!open || !close || !url) return null;
  const alt = parseMediaAlt(slice(open.to, close.from));
  return { from: node.from, to: node.to, altFrom: open.to, altTo: close.from, url: slice(url.from, url.to), alt };
}

export const formatMediaAlt = ({ text, width }: MediaAlt) => (width === null ? text : `${text}|${width}`);

export function localMediaId(url: string): number | null {
  const local = LOCAL_MEDIA.exec(url);
  return local ? Number(local[2]) : null;
}

export const mediaTypeOfUrl = (url: string): MediaType =>
  url.startsWith("video:") ? "video" : url.startsWith("document:") ? "document" : "image";

export function mediaUrl(url: string) {
  const id = localMediaId(url);
  return id === null ? url : mediaSource(id);
}

export const mediaMarkdown = ({ id, name, mediaType }: MediaSummary) =>
  `![${name.replace(/[[\]|\\]/g, "")}](${mediaType}:${id})`;
