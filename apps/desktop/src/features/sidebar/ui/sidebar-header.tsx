import { cn } from "cn";
import { m } from "motion/react";
import type { ReactNode } from "react";
import { sidebarWidth, useSidebarOpen } from "../model/sidebar-store";
import { useSidebarTransition } from "../hooks/use-sidebar-transition";

export function SidebarHeader({ className, children }: { className?: string; children: ReactNode }) {
  const open = useSidebarOpen();
  const width = sidebarWidth.useWidth();
  const resizing = sidebarWidth.useResizing();
  const transition = useSidebarTransition();

  return (
    <m.div
      className={cn("flex h-full shrink-0 items-center", className)}
      initial={false}
      animate={{ width: open ? width : "auto" }}
      transition={resizing ? { duration: 0 } : transition}
    >
      {children}
    </m.div>
  );
}
