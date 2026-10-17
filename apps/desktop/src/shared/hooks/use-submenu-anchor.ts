import { createContext, useContext, useRef, useState, type RefObject } from "react";

type SubmenuSide = "left" | "right";

interface SubmenuAnchor {
  trigger: RefObject<HTMLElement | null>;
  side: SubmenuSide;
}

export const SubmenuAnchorContext = createContext<SubmenuAnchor | null>(null);

const parentMenuOf = (trigger: HTMLElement | null) => trigger?.closest('[role="menu"]') ?? null;

export function useSubmenuAnchorState() {
  const trigger = useRef<HTMLElement>(null);
  const [side, setSide] = useState<SubmenuSide>("right");
  const followParent = (open: boolean) => {
    if (open) setSide(parentMenuOf(trigger.current)?.getAttribute("data-side") === "left" ? "left" : "right");
  };
  return { anchor: { trigger, side }, followParent };
}

export const useSubmenuTriggerRef = () => useContext(SubmenuAnchorContext)?.trigger;

function besideParentMenu(trigger: HTMLElement | null) {
  const menu = parentMenuOf(trigger);
  if (!trigger || !menu) return null;
  return {
    contextElement: trigger,
    getBoundingClientRect: () => {
      const { x, width } = menu.getBoundingClientRect();
      const { y, height } = trigger.getBoundingClientRect();
      return new DOMRect(x, y, width, height);
    },
  };
}

export function useParentMenuAnchor() {
  const context = useContext(SubmenuAnchorContext);
  return {
    anchor: () => besideParentMenu(context?.trigger.current ?? null),
    side: context?.side ?? "right",
    collisionAvoidance: { side: "flip", align: "shift", fallbackAxisSide: "end" } as const,
  };
}
