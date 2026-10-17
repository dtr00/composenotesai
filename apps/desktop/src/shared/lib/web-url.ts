const WEB_URL = /^https?:\/\//i;

export const isWebUrl = (url: string) => WEB_URL.test(url);

export function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}
