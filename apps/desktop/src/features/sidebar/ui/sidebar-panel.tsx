import { cn } from "cn";
import type { ComponentProps, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { VERTICAL_ARROW_STEPS } from "../../../shared/lib/arrow-steps";

interface SidebarPanelProps extends ComponentProps<"nav"> {
  footer?: ReactNode;
}

function stepThrough(panel: HTMLElement, event: globalThis.KeyboardEvent, from: Element | null) {
  const offset = VERTICAL_ARROW_STEPS[event.key];
  if (!offset || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const items = [...panel.querySelectorAll<HTMLElement>("[data-sidebar-item]")].filter(
    (item) => item.getClientRects().length > 0,
  );
  const index = from ? items.findIndex((item) => item === from) : -1;
  if (index === -1 && from !== null) return;
  const next = items[Math.min(items.length - 1, Math.max(0, index + offset))];
  if (!next) return;
  event.preventDefault();
  next.focus();
  if (next.dataset.sidebarItem === "open") next.click();
}

function followUnfocusedArrows(panel: HTMLDivElement) {
  const handle = (event: globalThis.KeyboardEvent) => {
    if (event.defaultPrevented || document.activeElement !== document.body) return;
    stepThrough(panel, event, panel.querySelector('[data-sidebar-item][aria-current="page"]'));
  };
  window.addEventListener("keydown", handle);
  return () => window.removeEventListener("keydown", handle);
}

function focusPressedItem(event: PointerEvent<HTMLElement>) {
  if (!(event.target instanceof Element)) return;
  event.target.closest<HTMLElement>("[data-sidebar-item]")?.focus();
}

export function SidebarPanel({ className, children, footer, onKeyDown, onPointerDown, ...props }: SidebarPanelProps) {
  return (
    <nav
      className={cn(
        "flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground sidebar-surface",
        className,
      )}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) stepThrough(event.currentTarget, event.nativeEvent, document.activeElement);
      }}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        onPointerDown?.(event);
        focusPressedItem(event);
      }}
      {...props}
    >
      <div ref={followUnfocusedArrows} className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {children}
      </div>
      {footer && <div className="flex shrink-0 items-center px-3 pb-3">{footer}</div>}
    </nav>
  );
}
