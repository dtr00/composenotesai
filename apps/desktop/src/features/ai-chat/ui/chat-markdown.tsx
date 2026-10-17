import { GFM, parser } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { memo, type ReactNode } from "react";
import { getEntries } from "../../../entities/note/model/note-list-store";
import { findNoteByTitle } from "../../../entities/note/model/note-tree";
import { mediaSource } from "../../../shared/api/notes";
import { MARKDOWN_EXTENSIONS } from "../../../shared/lib/markdown-extensions";
import { isWebUrl } from "../../../shared/lib/web-url";
import { parseWikiLink, splitWikiLink, type WikiTarget } from "../../../shared/lib/wiki-link-syntax";
import {
  MarkdownView,
  type MarkdownOverrides,
  type MarkdownRender,
  type MarkdownStyle,
} from "../../../shared/ui/markdown-view";
import { appLink, mediaLinkId } from "../lib/app-links";
import { chatHost } from "../model/chat-host";
import { AppMention } from "./app-mention";
import { ChatCodeBlock } from "./chat-code-block";

const markdown = parser.configure([GFM, ...MARKDOWN_EXTENSIONS]);

const STYLE: MarkdownStyle = {
  inlineCode: "rounded bg-foreground/8 px-1 py-px font-mono text-[0.92em]",
  headingLevelOffset: 2,
  headings: ["mt-1 text-base font-semibold", "mt-1 text-sm font-semibold", "mt-1 text-[13px] font-semibold"],
  blockquote: "flex flex-col gap-2 border-l-2 pl-3 text-muted-foreground",
  bulletList: () => "flex list-disc flex-col gap-1 pl-5",
  orderedList: "flex list-decimal flex-col gap-1 pl-5",
  taskItem: "flex list-none items-start gap-1.5",
  rule: "border-border",
  table: {
    wrapper: "overflow-x-auto",
    table: "w-full border-collapse text-left",
    row: "border-b border-border/60 last:border-0",
    headerCell: "border-b px-2 py-1 font-medium",
    cell: "px-2 py-1 align-top",
  },
};

function ChatImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} loading="lazy" className="my-1 max-h-80 max-w-full rounded-md object-contain" />;
}

function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      href={url}
      className="text-primary underline underline-offset-2 hover:opacity-80"
      onClick={(event) => {
        event.preventDefault();
        chatHost().openLink(url);
      }}
    >
      {children}
    </a>
  );
}

function link(node: SyntaxNode, { slice, inline }: MarkdownRender): ReactNode {
  if (node.name === "URL")
    return <ExternalLink url={slice(node.from, node.to)}>{slice(node.from, node.to)}</ExternalLink>;
  if (node.name === "Autolink") {
    const url = node.getChild("URL");
    const href = url ? slice(url.from, url.to) : "";
    return <ExternalLink url={href}>{href}</ExternalLink>;
  }
  const marks = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  const labelFrom = marks[0]?.to ?? node.from;
  const labelTo = marks[1]?.from ?? node.to;
  if (!url) return inline(node, labelFrom, labelTo);
  const href = slice(url.from, url.to).replace(/^<|>$/g, "");
  const text = slice(labelFrom, labelTo).split("|")[0].trim();
  const mediaId = node.name === "Image" ? mediaLinkId(href) : null;
  if (mediaId !== null) return <ChatImage src={mediaSource(mediaId)} alt={text} />;
  if (node.name === "Image" && isWebUrl(href)) return <ChatImage src={href} alt={text} />;
  const target = appLink(href);
  if (target) return <AppMention link={target} label={text} />;
  return <ExternalLink url={href}>{text ? inline(node, labelFrom, labelTo) : href}</ExternalLink>;
}

function noteMention({ title, label }: WikiTarget): ReactNode {
  const note = findNoteByTitle(getEntries(), title);
  return note ? <AppMention link={{ kind: "entry", ref: { kind: "note", id: note.id } }} label={label} /> : null;
}

function wikiLink(node: SyntaxNode, { slice }: MarkdownRender): ReactNode {
  const target = splitWikiLink(slice(node.from + 2, node.to - 2), node.from + 2);
  return noteMention(target) ?? target.label;
}

function inlineCode(code: string): ReactNode {
  const target = parseWikiLink(code.trim());
  return target && noteMention(target);
}

function TaskBox({ checked }: { checked: boolean }) {
  return <input type="checkbox" checked={checked} readOnly tabIndex={-1} className="mt-[0.3em] -ml-4 accent-primary" />;
}

const OVERRIDES: MarkdownOverrides = {
  link,
  image: link,
  wikiLink,
  inlineCode,
  code: (node, { slice }) => {
    const code = node.getChild("CodeText");
    return <ChatCodeBlock code={code ? slice(code.from, code.to) : ""} />;
  },
  paragraph: (node, { inline }) => <p className="whitespace-pre-line">{inline(node)}</p>,
  taskBox: TaskBox,
  asParagraph: (node) => node.name === "HTMLBlock",
};

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 text-[13px]/relaxed wrap-break-word select-text">
      <MarkdownView text={text} tree={markdown.parse(text)} style={STYLE} overrides={OVERRIDES} />
    </div>
  );
});
