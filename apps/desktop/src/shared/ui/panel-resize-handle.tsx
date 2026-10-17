import { cn } from "cn";
import type { KeyboardEvent, PointerEvent } from "react";
import { trackPointerDrag } from "../lib/pointer-drag";

const KEY_STEP_PX = 16;

export interface PanelWidthControl {
  limits: { min: number; max: number; default: number };
  savedWidth: () => number;
  preview: (width: number) => void;
  commit: (width?: number) => void;
  cancel: () => void;
}

interface PanelResizeHandleProps {
  label: string;
  edge: "left" | "right";
  width: number;
  control: PanelWidthControl;
}

export function PanelResizeHandle({ label, edge, width, control }: PanelResizeHandleProps) {
  const { limits, preview, commit, cancel } = control;
  const growth = edge === "right" ? 1 : -1;

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    const start = control.savedWidth();
    event.preventDefault();
    trackPointerDrag(event, {
      cursor: "col-resize",
      onStart: () => preview(start),
      onMove: (move) => preview(start + growth * (move.clientX - event.clientX)),
      onEnd: (dropped) => (dropped ? commit() : cancel()),
    });
  };

  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -growth * KEY_STEP_PX, ArrowRight: growth * KEY_STEP_PX }[event.key];
    const [home, end] = edge === "right" ? [limits.min, limits.max] : [limits.max, limits.min];
    const target = { Home: home, End: end }[event.key];
    if (step === undefined && target === undefined) return;
    event.preventDefault();
    commit(target ?? width + (step ?? 0));
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startResize}
      onDoubleClick={() => commit(limits.default)}
      onKeyDown={resizeWithKeys}
      className={cn(
        "group/resize absolute inset-y-0 z-10 flex w-2 cursor-col-resize justify-center outline-none",
        edge === "right" ? "-right-1" : "-left-1",
      )}
    >
      <span className="h-full w-px bg-transparent transition-colors group-hover/resize:bg-ring group-focus-visible/resize:bg-ring group-active/resize:bg-ring" />
    </div>
  );
}
