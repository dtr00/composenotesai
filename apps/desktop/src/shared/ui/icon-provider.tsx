import { LucideProvider } from "lucide-react";
import type { ReactNode } from "react";

export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <LucideProvider strokeWidth={1.25} nonScalingStroke>
      {children}
    </LucideProvider>
  );
}
