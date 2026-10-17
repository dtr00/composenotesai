import type { DownloadProgress } from "../api/download";

type ProgressSetter = (progress: DownloadProgress | null) => void;

export function withEntry<T>(entries: Record<string, T>, id: string, value: T | null): Record<string, T> {
  const next = { ...entries };
  if (value) next[id] = value;
  else delete next[id];
  return next;
}

export async function trackDownload<T>(
  setProgress: ProgressSetter,
  download: (onProgress: ProgressSetter) => Promise<T>,
): Promise<T> {
  setProgress({ downloaded: 0, total: 1 });
  try {
    return await download(setProgress);
  } finally {
    setProgress(null);
  }
}
