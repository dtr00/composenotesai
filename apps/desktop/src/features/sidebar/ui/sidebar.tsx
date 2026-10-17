import { m } from "motion/react";
import type { ReactNode } from "react";
import { PanelResizeHandle } from "../../../shared/ui/panel-resize-handle";
import { sidebarWidth, useSidebarOpen } from "../model/sidebar-store";
import { useSidebarTransition } from "../hooks/use-sidebar-transition";

export function Sidebar({ children }: { children: ReactNode }) {
  const open = useSidebarOpen();
  const width = sidebarWidth.useWidth();
  const resizing = sidebarWidth.useResizing();
  const transition = useSidebarTransition();

  return (
    <m.div
      className="relative shrink-0"
      style={{ width }}
      initial={false}
      animate={{ marginLeft: open ? 0 : -width }}
      transition={resizing ? { duration: 0 } : transition}
      inert={!open}
    >
      {children}
      {open && <PanelResizeHandle label="Resize sidebar" edge="right" width={width} control={sidebarWidth} />}
    </m.div>
  );
}
