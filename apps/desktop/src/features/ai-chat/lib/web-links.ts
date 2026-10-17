const LINK = /https?:\/\/[^\s<>()"'`\]]+/g;
const TRAILING = /[.,;:!?*_]+$/;

export function pageKey(url: string): string | null {
  try {
    const parsed = new URL(url.replace(TRAILING, ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const linksIn = (text: string): string[] => [...text.matchAll(LINK)].flatMap(([link]) => pageKey(link) ?? []);
