const SNAPPED = "[data-pixel-snap]";

function snapToPixels(element: HTMLElement) {
  element.style.translate = "";
  const { x, y } = element.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const dx = Math.round(x * ratio) / ratio - x;
  const dy = Math.round(y * ratio) / ratio - y;
  if (dx !== 0 || dy !== 0) element.style.translate = `${dx}px ${dy}px`;
}

export function snapWithin(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(SNAPPED).forEach(snapToPixels);
}
