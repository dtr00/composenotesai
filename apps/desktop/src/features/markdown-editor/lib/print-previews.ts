import type { Tree } from "@lezer/common";
import type { LinkPreview } from "../../../shared/api/link-preview";
import { readLinkEmbed } from "./link-embed-markdown";
import type { TextSlice } from "./markdown-rules";
import { previewFor } from "./page-previews";

const IMAGE_TIMEOUT_MS = 5000;

export type LinkPreviews = ReadonlyMap<string, LinkPreview | null>;

function imageLoads(src: string) {
  const image = new Image();
  image.referrerPolicy = "no-referrer";
  image.src = src;
  const timeout = new Promise<boolean>((resolve) => setTimeout(resolve, IMAGE_TIMEOUT_MS, false));
  return Promise.race([
    image.decode().then(
      () => true,
      () => false,
    ),
    timeout,
  ]);
}

async function printablePreview(url: string) {
  const preview = await previewFor(url);
  if (!preview?.image || (await imageLoads(preview.image))) return preview;
  return { ...preview, image: null };
}

export async function loadLinkPreviews(tree: Tree, markdown: string): Promise<LinkPreviews> {
  const slice: TextSlice = (from, to) => markdown.slice(from, to);
  const whole = { from: 0, to: markdown.length };
  const urls = new Set<string>();
  tree.iterate({
    enter: (node) => {
      if (node.name !== "Link") return;
      const embed = readLinkEmbed(node.node, slice, whole);
      if (embed) urls.add(embed.url);
      return false;
    },
  });
  return new Map(await Promise.all([...urls].map(async (url) => [url, await printablePreview(url)] as const)));
}
