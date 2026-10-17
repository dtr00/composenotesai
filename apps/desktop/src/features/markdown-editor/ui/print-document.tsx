import type { Parser, SyntaxNode, Tree } from "@lezer/common";
import { highlightCode } from "@lezer/highlight";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { codeTokens } from "../lib/code-highlight";
import { codeLanguage } from "../lib/code-languages";
import { localMediaId, mediaTypeOfUrl, mediaUrl, readMedia, type MediaAlt } from "../lib/media-markdown";
import { linkHref } from "../lib/link-clicks";
import { readLinkEmbed, type MarkdownLinkEmbed } from "../lib/link-embed-markdown";
import type { LinkPreviews } from "../lib/print-previews";
import { useMedia, useMediaMissing } from "../../../entities/note/model/note-list-store";
import type { LinkPreview } from "../../../shared/api/link-preview";
import type { MediaType } from "../../../shared/api/notes";
import { hostName } from "../../../shared/lib/web-url";
import { FileSummary } from "./document-embed";
import { Summary } from "./link-embed";
import { MissingMedia } from "./media-embed";
import { isShortSetext, isStarRule, listDepth, standsAlone, type TextSlice } from "../lib/markdown-rules";
import { parseTable, type ColumnAlign } from "../lib/markdown-table";
import { splitWikiLink } from "../../../shared/lib/wiki-link-syntax";
import {
  keyed,
  MarkdownView,
  type MarkdownOverrides,
  type MarkdownRender,
  type MarkdownStyle,
} from "../../../shared/ui/markdown-view";

const BULLET_STYLES = ["list-disc", "list-[circle]", "list-[square]"];

const ALIGN_CLASSES: Record<NonNullable<ColumnAlign>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const PARAGRAPH = "my-2 leading-relaxed";

const LINK = "text-primary underline";

const STYLE: MarkdownStyle = {
  strong: "font-semibold",
  inlineCode: "rounded bg-muted px-1 py-0.5 font-mono text-[0.875em]",
  headingLevelOffset: 1,
  headings: [
    "mt-6 mb-2 text-2xl font-semibold",
    "mt-5 mb-2 text-xl font-semibold",
    "mt-4 mb-1.5 text-lg font-semibold",
    "mt-3 mb-1 text-base font-semibold",
  ],
  blockquote: "my-2 border-l-3 pl-4 text-muted-foreground",
  bulletList: (list) => `my-2 pl-6 ${BULLET_STYLES[listDepth(list) % BULLET_STYLES.length]}`,
  orderedList: "my-2 list-decimal pl-6",
  listItem: "my-0.5",
  taskItem: "my-0.5 flex list-none items-start gap-2",
  checkedTask: "text-muted-foreground line-through",
  rule: "my-4 border-border",
  table: {
    table: "my-3 w-full border-collapse text-sm break-inside-avoid",
    headerRow: "break-inside-avoid",
    row: "break-inside-avoid",
    headerCell: "border px-2 py-1 align-top bg-muted font-semibold",
    cell: "border px-2 py-1 align-top",
    column: (source) => {
      const { align } = parseTable(source);
      return (column) => ALIGN_CLASSES[align[column] ?? "left"];
    },
  },
};

export type CodeParsers = ReadonlyMap<string, Parser>;

function EmbedFrame({ block, children }: { block: boolean; children: ReactNode }) {
  return <span className={block ? "my-3 flex break-inside-avoid" : "inline-flex align-bottom"}>{children}</span>;
}

function FileCard({ mediaType, mediaId, alt }: { mediaType: MediaType; mediaId: number | null; alt: string }) {
  const media = useMedia(mediaId);
  return (
    <span className="flex w-full max-w-sm items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground">
      <FileSummary mediaType={mediaType} media={media} alt={alt} />
    </span>
  );
}

function MediaView({ url, alt, block }: { url: string; alt: MediaAlt; block: boolean }) {
  const mediaType = mediaTypeOfUrl(url);
  const mediaId = localMediaId(url);
  const missing = useMediaMissing(mediaId) || (mediaType !== "image" && mediaId === null);
  if (missing || mediaType !== "image") {
    return (
      <EmbedFrame block={block}>
        {missing ? (
          <MissingMedia mediaType={mediaType} alt={alt.text} />
        ) : (
          <FileCard mediaType={mediaType} mediaId={mediaId} alt={alt.text} />
        )}
      </EmbedFrame>
    );
  }
  const image = (
    <img
      src={mediaUrl(url)}
      alt={alt.text}
      className="inline-block h-auto max-w-full rounded-md align-bottom"
      style={{ width: alt.width ?? undefined }}
    />
  );
  return block ? <figure className="my-3 flex justify-center break-inside-avoid">{image}</figure> : image;
}

function Media({ slice, node, block }: { slice: TextSlice; node: SyntaxNode; block: boolean }) {
  const media = readMedia(node, slice);
  return media && <MediaView url={media.url} alt={media.alt} block={block} />;
}

function link(node: SyntaxNode, { slice, inline }: MarkdownRender): ReactNode {
  if (node.name !== "Link") {
    const url = node.name === "URL" ? node : node.getChild("URL");
    const text = url ? slice(url.from, url.to) : slice(node.from, node.to);
    return (
      <a href={linkHref(text)} className={LINK}>
        {text}
      </a>
    );
  }
  const [open, close] = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  const href = url ? linkHref(slice(url.from, url.to)) : undefined;
  const text = open && close ? inline(node, open.to, close.from) : [slice(node.from, node.to)];
  return (
    <a href={href} className={LINK}>
      {text.length > 0 ? text : href}
    </a>
  );
}

function wikiLink(node: SyntaxNode, { slice }: MarkdownRender): ReactNode {
  const [open, close] = node.getChildren("WikiLinkMark");
  if (!open || !close) return null;
  return <span className="text-primary">{splitWikiLink(slice(open.to, close.from), open.to).label}</span>;
}

function LinkCard({ embed, preview }: { embed: MarkdownLinkEmbed; preview: LinkPreview | null | undefined }) {
  return (
    <a
      href={embed.url}
      className="my-3 flex h-28 max-w-xl overflow-hidden rounded-lg border bg-card text-card-foreground break-inside-avoid"
    >
      <Summary
        title={embed.label || preview?.title || hostName(embed.url)}
        description={preview?.description}
        site={embed.url}
      />
      {preview?.image && (
        <img
          src={preview.image}
          alt=""
          referrerPolicy="no-referrer"
          className="aspect-[1.91/1] h-full shrink-0 object-cover"
        />
      )}
    </a>
  );
}

function blockEmbed(node: SyntaxNode, { text, slice }: MarkdownRender, previews: LinkPreviews): ReactNode {
  const whole = { from: 0, to: text.length };
  if (node.name === "Image") return standsAlone(slice, whole, node) ? <Media slice={slice} node={node} block /> : null;
  const embed = node.name === "Link" ? readLinkEmbed(node, slice, whole) : null;
  return embed && <LinkCard embed={embed} preview={previews.get(embed.url)} />;
}

function paragraph(node: SyntaxNode, markdown: MarkdownRender, previews: LinkPreviews): ReactNode {
  if (node.name !== "Paragraph") return <p className={PARAGRAPH}>{markdown.inline(node)}</p>;
  const parts: ReactNode[] = [];
  const text = (from: number, to: number) => {
    if (markdown.slice(from, to).trim() === "") return;
    parts.push(<p className={PARAGRAPH}>{markdown.inline(node, from, to)}</p>);
  };
  let pos = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const embed = blockEmbed(child, markdown, previews);
    if (!embed) continue;
    text(pos, child.from);
    parts.push(embed);
    pos = child.to;
  }
  text(pos, node.to);
  return keyed(parts);
}

function codeCard(node: SyntaxNode, { slice }: MarkdownRender, parsers: CodeParsers): ReactNode {
  const info = node.getChild("CodeInfo");
  const text = node.getChild("CodeText");
  const code = text ? slice(text.from, text.to) : "";
  const language = codeLanguage(info ? slice(info.from, info.to) : "");
  const parser = parsers.get(language.id);
  const tokens: ReactNode[] = [];
  if (parser) {
    highlightCode(
      code,
      parser.parse(code),
      codeTokens,
      (part, classes) => tokens.push(classes ? <span className={classes}>{part}</span> : part),
      () => tokens.push("\n"),
    );
  } else {
    tokens.push(code);
  }
  return (
    <figure className="my-3 rounded-lg bg-muted px-4 pt-2 pb-3 break-inside-avoid">
      {node.name === "FencedCode" && (
        <figcaption className="mb-1 text-[0.625rem] font-medium text-muted-foreground">{language.label}</figcaption>
      )}
      <pre className="font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
        <code>{keyed(tokens)}</code>
      </pre>
    </figure>
  );
}

function TaskBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-[0.2em] flex size-4 shrink-0 items-center justify-center rounded-sm border ${checked ? "border-primary bg-primary text-primary-foreground" : ""}`}
    >
      {checked && <Check className="size-3" />}
    </span>
  );
}

const printOverrides = (parsers: CodeParsers, previews: LinkPreviews): MarkdownOverrides => ({
  link,
  image: (node, { slice }) => <Media slice={slice} node={node} block={false} />,
  wikiLink,
  code: (node, markdown) => codeCard(node, markdown, parsers),
  paragraph: (node, markdown) => paragraph(node, markdown, previews),
  taskBox: TaskBox,
  asParagraph: (node, slice) => isShortSetext(node, slice) || isStarRule(node, slice),
});

interface PrintDocumentProps {
  title: string;
  body: string;
  tree: Tree;
  parsers: CodeParsers;
  previews: LinkPreviews;
}

export function PrintDocument({ title, body, tree, parsers, previews }: PrintDocumentProps) {
  return (
    <article className="mx-auto max-w-3xl font-sans text-[0.9375rem] text-foreground [&_li>p]:my-0">
      <h1 className="mb-6 text-4xl leading-tight font-bold">{title}</h1>
      <MarkdownView text={body} tree={tree} style={STYLE} overrides={printOverrides(parsers, previews)} />
    </article>
  );
}
