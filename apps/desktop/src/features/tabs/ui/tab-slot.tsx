import { m, useIsPresent, type TargetAndTransition, type Transition } from "motion/react";
import type { ReactNode } from "react";

const TAB_WIDTH_PX = 192;
const TAB_MIN_WIDTH_PX = 56;
const HIDDEN = { width: 0, minWidth: "0px", opacity: 0 };
export const TAB_SHOWN = { width: TAB_WIDTH_PX, minWidth: `${TAB_MIN_WIDTH_PX}px`, opacity: 1 };
export const CHIP_SHOWN = { width: "auto", minWidth: "0px", opacity: 1 };

export const DRAG_STATES =
  "group-data-drop-target/slot:bg-sidebar-primary/15 group-data-drop-target/slot:ring-1 group-data-drop-target/slot:ring-sidebar-primary group-data-drop-target/slot:ring-inset group-data-dragging/slot:bg-muted! group-data-dragging/slot:text-foreground! group-data-dragging/slot:shadow-md";

interface TabSlotProps {
  shown: TargetAndTransition;
  grouped: boolean;
  transition: Transition;
  children: ReactNode;
  "data-tab-id"?: number;
  "data-tab-group"?: number;
  "data-group-chip"?: number;
}

export function TabSlot({ shown, grouped, transition, children, ...data }: TabSlotProps) {
  const isPresent = useIsPresent();

  return (
    <m.div
      {...data}
      inert={!isPresent}
      className="group/slot relative flex h-full items-center overflow-hidden px-px data-dragging:z-10 data-dragging:overflow-visible data-group-chip:shrink-0"
      initial={HIDDEN}
      animate={shown}
      exit={HIDDEN}
      transition={transition}
    >
      {children}
      {grouped && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-sidebar-primary" />
      )}
    </m.div>
  );
}
