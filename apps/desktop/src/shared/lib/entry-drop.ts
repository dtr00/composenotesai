import type { EntryRef } from "../api/notes";

export interface EntryDropZone {
  element: HTMLElement;
  accepts: (refs: EntryRef[]) => boolean;
  setOver: (over: boolean) => void;
  drop: (refs: EntryRef[]) => void;
}

const zones = new Set<EntryDropZone>();

export function addEntryDropZone(zone: EntryDropZone) {
  zones.add(zone);
  return () => {
    zones.delete(zone);
  };
}

export function containsPoint(element: HTMLElement, x: number, y: number) {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return x >= left && x <= right && y >= top && y <= bottom;
}

export function trackEntryDrop(refs: EntryRef[]) {
  let over: EntryDropZone | null = null;
  const hover = (zone: EntryDropZone | null) => {
    if (zone === over) return;
    over?.setOver(false);
    over = zone;
    over?.setOver(true);
  };

  return {
    hoverZoneAt(x: number, y: number): boolean {
      hover([...zones].find((zone) => containsPoint(zone.element, x, y) && zone.accepts(refs)) ?? null);
      return over !== null;
    },
    dropIntoZone(dropped: boolean): boolean {
      const zone = over;
      hover(null);
      if (!dropped || !zone) return false;
      zone.drop(refs);
      return true;
    },
  };
}
