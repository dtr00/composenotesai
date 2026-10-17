import { markdownLanguage } from "@codemirror/lang-markdown";
import { MarkdownParser } from "@lezer/markdown";
import { MARKDOWN_EXTENSIONS } from "../../../shared/lib/markdown-extensions";

export const NOTE_MARKDOWN = { base: markdownLanguage, extensions: MARKDOWN_EXTENSIONS };

let parser: MarkdownParser | null = null;

function noteParser() {
  if (parser) return parser;
  const base = NOTE_MARKDOWN.base.parser;
  if (!(base instanceof MarkdownParser)) throw new Error("The note language is not built on a Markdown parser.");
  parser = base.configure(NOTE_MARKDOWN.extensions);
  return parser;
}

export const parseNoteMarkdown = (text: string) => noteParser().parse(text);
