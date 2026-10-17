import { Globe, Images, Newspaper } from "lucide-react";
import { readWebPage, searchImages, searchWeb, type ImageResult } from "../../../shared/api/ai";
import { requiredString, stringArg, type ToolArgs } from "../lib/tool-args";
import { linksIn, pageKey } from "../lib/web-links";
import type { AgentTool } from "./agent-tools";
import type { ConversationMessage } from "./conversation";

const MAX_IMAGES = 8;
const MAX_RESULTS = 8;

const pagesFromTrustedSources = new Set<string>();

const trust = (links: string[]) => links.forEach((link) => pagesFromTrustedSources.add(link));

const TOOLS_WITH_TRUSTED_LINKS = new Set(["web_search"]);

export function trustOnlyPagesLinkedFrom(messages: ConversationMessage[]) {
  pagesFromTrustedSources.clear();
  for (const message of messages) {
    if (message.role === "user") {
      trust(linksIn(message.text));
      for (const attachment of message.attachments) trust(linksIn(attachment.content));
      continue;
    }
    for (const part of message.parts) {
      if (part.kind === "tool" && TOOLS_WITH_TRUSTED_LINKS.has(part.name) && part.result) trust(linksIn(part.result));
    }
  }
}

const count = (args: ToolArgs, max: number, fallback: number) =>
  typeof args.count === "number" ? Math.min(Math.max(Math.round(args.count), 1), max) : fallback;

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "Search the web. Use it to research a topic, look up facts or current information, or check something you aren't sure of. Returns titles, links and short snippets; read the best pages with read_web_page.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to search for." },
      count: { type: "integer", description: `How many results, 1 to ${MAX_RESULTS}. Defaults to 6.` },
    },
    required: ["query"],
  },
  edits: false,
  verbs: { running: "Searching the web", done: "Searched the web" },
  noun: null,
  icon: Globe,
  label: (args, verb) => {
    const query = stringArg(args, "query");
    return query ? `${verb} for “${query}”` : verb;
  },
  run: async (args) => {
    const query = requiredString(args, "query");
    const results = await searchWeb(query, count(args, MAX_RESULTS, 6));
    if (results.length === 0) return { result: `Nothing found for “${query}”. Try other words.` };
    trust(results.flatMap(({ url }) => pageKey(url) ?? []));
    const lines = results.map(
      ({ title, url, snippet }, index) => `${index + 1}. ${title}\n   ${url}${snippet ? `\n   ${snippet}` : ""}`,
    );
    return { result: `Results for “${query}”:\n\n${lines.join("\n")}` };
  },
};

const readPageTool: AgentTool = {
  name: "read_web_page",
  description:
    "Read the text of a web page from your web_search results or a link the user gave you. Use it to check details before you answer.",
  parameters: {
    type: "object",
    properties: { url: { type: "string", description: "The page address, copied from the results." } },
    required: ["url"],
  },
  edits: false,
  verbs: { running: "Reading", done: "Read" },
  noun: "page",
  icon: Newspaper,
  label: (args, verb) => {
    const site = host(stringArg(args, "url"));
    return site ? `${verb} ${site}` : `${verb} a web page`;
  },
  run: async (args) => {
    const url = requiredString(args, "url");
    const key = pageKey(url);
    if (!key || !pagesFromTrustedSources.has(key)) {
      throw new Error(
        "You can only read pages from your web_search results or links the user gave you. Search first, then copy a link from the results.",
      );
    }
    const page = await readWebPage(url);
    const more = page.truncated ? "\n\n[The page goes on, but this is as much as fits.]" : "";
    return {
      result: `Title: ${page.title ?? "(none)"}\nAddress: ${page.url}\n\n${page.text || "(No readable text.)"}${more}`,
    };
  },
};

const altText = (title: string) => title.replace(/[[\]|]/g, "").trim() || "Image";

function describeImage(image: ImageResult, index: number) {
  const size = image.width && image.height ? `${image.width}×${image.height}` : null;
  const credit = [size, image.license, image.creator && `by ${image.creator}`, image.source, image.page]
    .filter(Boolean)
    .join(" · ");
  return `${index + 1}. ![${altText(image.title)}](${image.url})\n   ${credit}`;
}

const searchImagesTool: AgentTool = {
  name: "search_images",
  description:
    "Search the web for openly licensed images. Returns Markdown image lines you can put in a reply or a note as they are.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What the image should show, in a few words." },
      count: { type: "integer", description: `How many images to find, 1 to ${MAX_IMAGES}. Defaults to 4.` },
    },
    required: ["query"],
  },
  edits: false,
  verbs: { running: "Searching for images", done: "Searched for images" },
  noun: null,
  icon: Images,
  label: (args, verb) => {
    const query = stringArg(args, "query");
    return query ? `${verb} for “${query}”` : verb;
  },
  run: async (args) => {
    const query = requiredString(args, "query");
    const images = await searchImages(query, count(args, MAX_IMAGES, 4));
    if (images.length === 0) return { result: `No images found for “${query}”. Try other words.` };
    return {
      result: `Found ${images.length} images for “${query}”. To show one, copy its Markdown line. Under an image you put in a note, add a short credit line like "Photo: creator, license, source".\n\n${images.map(describeImage).join("\n")}`,
    };
  },
};

export const WEB_TOOLS: AgentTool[] = [webSearchTool, readPageTool, searchImagesTool];
