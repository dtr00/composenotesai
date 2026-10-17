export function serializeSaves(flush: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> = Promise.resolve();
  let queued: Promise<void> | null = null;
  return () => {
    if (queued) return queued;
    const next = running
      .catch(() => undefined)
      .then(() => {
        queued = null;
        return flush();
      });
    queued = next;
    running = next;
    return next;
  };
}

export function saveWhenChanged<T>(snapshot: () => T, write: (value: T) => Promise<void>): () => Promise<void> {
  let saved: string | null = null;
  return serializeSaves(async () => {
    const value = snapshot();
    const serialized = JSON.stringify(value);
    if (serialized === saved) return;
    await write(value);
    saved = serialized;
  });
}
