import { SEARCH_ENGINES, type SearchEngine } from "../../../shared/api/settings";
import { isWebUrl } from "../../../shared/lib/web-url";

const ENGINES: Record<SearchEngine, { label: string; searchUrl: string }> = {
  google: { label: "Google", searchUrl: "https://www.google.com/search?q=" },
  duckDuckGo: { label: "DuckDuckGo", searchUrl: "https://duckduckgo.com/?q=" },
  bing: { label: "Bing", searchUrl: "https://www.bing.com/search?q=" },
};

export const SEARCH_ENGINE_OPTIONS = SEARCH_ENGINES.map((value) => ({ value, label: ENGINES[value].label }));
const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#]|$)/i;
const DOMAIN = /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i;

function parsed(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

export function resolveAddress(input: string, engine: SearchEngine): string | null {
  const search = (query: string) => `${ENGINES[engine].searchUrl}${encodeURIComponent(query)}`;
  const text = input.trim();
  if (text === "") return null;
  if (isWebUrl(text)) return parsed(text) ?? search(text);
  if (LOCAL_HOST.test(text)) return parsed(`http://${text}`) ?? search(text);
  if (DOMAIN.test(text)) return parsed(`https://${text}`) ?? search(text);
  return search(text);
}
