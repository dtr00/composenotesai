const DRAG_THRESHOLD_PX = 4;
const DRAGGING_CLASS = "dragging";
const DRAG_CURSOR = "--drag-cursor";
const GRABBING = "grabbing";

function holdCursor(cursor: string) {
  const root = document.documentElement;
  root.style.setProperty(DRAG_CURSOR, cursor);
  root.classList.add(DRAGGING_CLASS);
  return () => {
    root.classList.remove(DRAGGING_CLASS);
    root.style.removeProperty(DRAG_CURSOR);
  };
}

export interface PointerDrag {
  cursor?: string;
  onStart: (event: PointerEvent) => void;
  onMove: (event: PointerEvent) => void;
  onEnd: (dropped: boolean) => void;
}

interface PointerStart {
  button: number;
  clientX: number;
  clientY: number;
}

function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
}

export function trackPointerDrag(start: PointerStart, drag: PointerDrag) {
  if (start.button !== 0) return;
  let dragging = false;
  let releaseCursor = () => {};

  const move = (event: PointerEvent) => {
    if (event.buttons === 0) {
      cancel();
      return;
    }
    if (!dragging) {
      if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      releaseCursor = holdCursor(drag.cursor ?? GRABBING);
      drag.onStart(event);
    }
    drag.onMove(event);
  };
  const finish = (dropped: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", escape);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", cancel);
    if (!dragging) return;
    releaseCursor();
    swallowNextClick();
    drag.onEnd(dropped);
  };
  const end = () => finish(true);
  const cancel = () => finish(false);
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") cancel();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", escape);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", cancel);
}
