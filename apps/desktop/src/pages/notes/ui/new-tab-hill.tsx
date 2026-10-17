import type { ReactNode } from "react";

export function NewTabHill({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto relative flex flex-col gap-1">{children}</div>
    </div>
  );
}
