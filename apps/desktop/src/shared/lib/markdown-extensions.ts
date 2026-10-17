import type { MarkdownExtension } from "@lezer/markdown";
import { mathSyntax } from "./math-syntax";
import { wikiLinkSyntax } from "./wiki-link-syntax";

export const MARKDOWN_EXTENSIONS: MarkdownExtension[] = [wikiLinkSyntax, mathSyntax];

export const UNDERLINE_OPEN = "<u>";
export const UNDERLINE_CLOSE = "</u>";
