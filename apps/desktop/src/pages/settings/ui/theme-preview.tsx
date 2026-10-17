import { cn } from "cn";
import type { Theme } from "../../../shared/api/settings";

type Scheme = Exclude<Theme, "system">;

function WindowSketch({ scheme, className }: { scheme: Scheme; className?: string }) {
  return (
    <div className={cn(scheme, "absolute inset-0 bg-muted", className)}>
      <div className="absolute top-3 right-0 bottom-0 left-4 flex flex-col overflow-hidden rounded-tl-md bg-background after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_1px_1px_0_var(--border)]">
        <div className="flex h-2.5 shrink-0 items-center gap-0.5 border-b border-sidebar-border bg-sidebar px-1.5">
          <div className="h-1 w-6 rounded-full bg-sidebar-foreground/30" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-1/4 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-1.5">
            <div className="h-1 w-full rounded-full bg-sidebar-foreground/30" />
            <div className="h-1 w-2/3 rounded-full bg-sidebar-foreground/30" />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-1.5">
            <div className="h-1.5 w-1/3 rounded-full bg-foreground/80" />
            <div className="h-1 w-5/6 rounded-full bg-muted-foreground/40" />
            <div className="h-1 w-2/3 rounded-full bg-muted-foreground/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div
      aria-hidden
      className="relative h-16 overflow-hidden rounded-md after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-foreground/10 after:ring-inset"
    >
      {theme === "system" ? (
        <>
          <WindowSketch scheme="light" />
          <WindowSketch scheme="dark" className="[clip-path:inset(0_0_0_50%)]" />
        </>
      ) : (
        <WindowSketch scheme={theme} />
      )}
    </div>
  );
}
