import { RESET_ZOOM_HOTKEY, ZOOM_IN_HOTKEYS, ZOOM_OUT_HOTKEY } from "../../../entities/settings/model/reserved-hotkeys";
import { hotkeyFromEvent, sameHotkey } from "../../../shared/lib/hotkeys";
import { createStore, useSelector } from "../../../shared/lib/store";

const LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const store = createStore<Record<number, number>>({});

export const documentZoom = (id: number) => store.get()[id] ?? 1;

export const useDocumentZoom = (id: number) => useSelector(store, (zooms) => zooms[id] ?? 1);

export const subscribeZoom = store.subscribe;

export const canZoomIn = (zoom: number) => zoom < LEVELS[LEVELS.length - 1];

export const canZoomOut = (zoom: number) => zoom > LEVELS[0];

const setZoom = (id: number, zoom: number) => store.set({ ...store.get(), [id]: zoom });

export function zoomIn(id: number) {
  const next = LEVELS.find((level) => level > documentZoom(id));
  if (next !== undefined) setZoom(id, next);
}

export function zoomOut(id: number) {
  const next = [...LEVELS].reverse().find((level) => level < documentZoom(id));
  if (next !== undefined) setZoom(id, next);
}

export const resetZoom = (id: number) => setZoom(id, 1);

export function pressedZoom(event: KeyboardEvent): ((id: number) => void) | null {
  const pressed = hotkeyFromEvent(event);
  if (!pressed) return null;
  if (ZOOM_IN_HOTKEYS.some((zoom) => sameHotkey(zoom, pressed))) return zoomIn;
  if (sameHotkey(ZOOM_OUT_HOTKEY, pressed)) return zoomOut;
  return sameHotkey(RESET_ZOOM_HOTKEY, pressed) ? resetZoom : null;
}
