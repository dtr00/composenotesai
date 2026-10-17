import { useRef } from "react";
import type { BrowserBounds } from "../../../shared/api/browser";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { isCoveredByPopup } from "../lib/popup-cover";
import { hideBrowser, placeBrowser, revealBrowser, showBrowser, visitBrowser } from "../model/browser-store";

const WATCHED_ATTRIBUTES = ["style", "class", "data-open", "data-closed"];

const boundsOf = ({ x, y, width, height }: DOMRect): BrowserBounds => ({ x, y, width, height });

const sameBounds = (a: BrowserBounds, b: BrowserBounds) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

function watchPopupLayers(area: Element, onChange: () => void) {
  const popups = new MutationObserver(onChange);
  const watch = (node: Node) => {
    if (!(node instanceof Element) || node.contains(area)) return;
    popups.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
  };
  const layers = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(watch);
    onChange();
  });
  layers.observe(document.body, { childList: true });
  [...document.body.children].forEach(watch);
  return () => {
    layers.disconnect();
    popups.disconnect();
  };
}

export function useBrowserView(tab: number, url: string) {
  const area = useRef<HTMLDivElement>(null);
  const visit = useRef<((url: string) => void) | null>(null);
  useMountEffect(() => {
    const element = area.current;
    if (!element) return;
    let placed = boundsOf(element.getBoundingClientRect());
    let covered = false;
    let frame = 0;
    showBrowser(tab, url, placed);
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const bounds = boundsOf(rect);
      const hidden = isCoveredByPopup(rect);
      if (hidden !== covered) {
        if (hidden) hideBrowser(tab);
        else revealBrowser(tab, bounds);
      } else if (!hidden && !sameBounds(placed, bounds)) {
        placeBrowser(tab, bounds);
      }
      covered = hidden;
      placed = bounds;
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    visit.current = (next) => {
      if (!visitBrowser(tab, next, placed)) return;
      covered = false;
      schedule();
    };
    const resizes = new ResizeObserver(schedule);
    resizes.observe(element);
    const stopWatching = watchPopupLayers(element, schedule);
    window.addEventListener("resize", schedule);
    return () => {
      visit.current = null;
      cancelAnimationFrame(frame);
      resizes.disconnect();
      stopWatching();
      window.removeEventListener("resize", schedule);
      hideBrowser(tab);
    };
  });
  return { area, visit };
}
