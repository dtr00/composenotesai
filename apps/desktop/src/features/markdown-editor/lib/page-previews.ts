import { loadLinkPreview, type LinkPreview } from "../../../shared/api/link-preview";

const MAX_REMEMBERED = 100;

const previews = new Map<string, Promise<LinkPreview | null>>();

export function previewFor(url: string) {
  let preview = previews.get(url);
  if (!preview) {
    if (previews.size >= MAX_REMEMBERED) previews.clear();
    preview = loadLinkPreview(url).catch(() => {
      previews.delete(url);
      return null;
    });
    previews.set(url, preview);
  }
  return preview;
}
