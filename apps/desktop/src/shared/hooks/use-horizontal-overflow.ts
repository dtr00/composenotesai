import { useCallback, useState, type RefCallback } from "react";

interface HorizontalOverflow {
  start: boolean;
  end: boolean;
}

const EDGE_TOLERANCE_PX = 1;

export function useHorizontalOverflow<T extends HTMLElement>(): [RefCallback<T>, HorizontalOverflow] {
  const [overflow, setOverflow] = useState<HorizontalOverflow>({ start: false, end: false });

  const observe = useCallback((element: T | null) => {
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft > EDGE_TOLERANCE_PX;
      const end = element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_TOLERANCE_PX;
      setOverflow((current) => (current.start === start && current.end === end ? current : { start, end }));
    };
    const resizes = new ResizeObserver(update);
    const observeSizes = () => {
      resizes.disconnect();
      resizes.observe(element);
      for (const child of element.children) resizes.observe(child);
    };
    const mutations = new MutationObserver(observeSizes);
    mutations.observe(element, { childList: true });
    element.addEventListener("scroll", update, { passive: true });
    observeSizes();
    return () => {
      resizes.disconnect();
      mutations.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  return [observe, overflow];
}
