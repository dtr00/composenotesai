import type { WheelEvent } from "react";

const EASE = 0.25;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const targets = new WeakMap<HTMLElement, { left: number }>();

function glide(element: HTMLElement, target: { left: number }) {
  const before = element.scrollLeft;
  element.scrollLeft = before + (target.left - before) * EASE;
  if (element.scrollLeft === before) {
    element.scrollLeft = target.left;
    targets.delete(element);
    return;
  }
  requestAnimationFrame(() => glide(element, target));
}

export function scrollHorizontallyOnWheel(event: WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const element = event.currentTarget;
  const current = targets.get(element);
  const max = element.scrollWidth - element.clientWidth;
  const left = Math.min(max, Math.max(0, (current?.left ?? element.scrollLeft) + event.deltaY));
  if (reducedMotion.matches) {
    element.scrollLeft = left;
  } else if (current) {
    current.left = left;
  } else {
    const target = { left };
    targets.set(element, target);
    requestAnimationFrame(() => glide(element, target));
  }
}
