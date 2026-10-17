import { createStore, useSelector } from "../../../shared/lib/store";

export type AiActivity = "reading" | "writing";

export const AI_ACTIVITY_LABELS: Record<AiActivity, string> = {
  reading: "AI is reading",
  writing: "AI is writing",
};

const READ_GLIMPSE_MS = 1200;
const WRITE_LINGER_MS = 700;

const store = createStore<ReadonlyMap<number, AiActivity>>(new Map());
const timers = new Map<number, number>();

export const useAiActivity = (noteId: number): AiActivity | undefined =>
  useSelector(store, (activity) => activity.get(noteId));

export const aiActivityOf = (noteId: number) => store.get().get(noteId);

export const subscribeToAiActivity = (listener: () => void) => store.subscribe(listener);

function set(noteId: number, activity: AiActivity | null) {
  const next = new Map(store.get());
  if (activity) next.set(noteId, activity);
  else next.delete(noteId);
  store.set(next);
}

function clearTimer(noteId: number) {
  window.clearTimeout(timers.get(noteId));
  timers.delete(noteId);
}

function endLater(noteId: number, activity: AiActivity, ms: number) {
  clearTimer(noteId);
  timers.set(
    noteId,
    window.setTimeout(() => {
      timers.delete(noteId);
      if (aiActivityOf(noteId) === activity) set(noteId, null);
    }, ms),
  );
}

export function startAiWriting(noteId: number) {
  clearTimer(noteId);
  if (aiActivityOf(noteId) !== "writing") set(noteId, "writing");
}

export function stopAiWriting(noteId: number) {
  clearTimer(noteId);
  if (aiActivityOf(noteId) === "writing") set(noteId, null);
}

export function finishAiWriting(noteId: number) {
  if (aiActivityOf(noteId) === "writing") endLater(noteId, "writing", WRITE_LINGER_MS);
}

export function showAiReading(noteId: number) {
  if (aiActivityOf(noteId) === "writing") return;
  set(noteId, "reading");
  endLater(noteId, "reading", READ_GLIMPSE_MS);
}

export function clearAiActivity() {
  for (const timer of timers.values()) window.clearTimeout(timer);
  timers.clear();
  store.set(new Map());
}
