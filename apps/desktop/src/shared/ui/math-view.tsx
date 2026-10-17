import { cn } from "cn";
import { useCallback } from "react";
import { renderMath } from "../lib/math";

interface MathViewProps {
  tex: string;
  display: boolean;
  className?: string;
}

export function MathView({ tex, display, className }: MathViewProps) {
  const draw = useCallback(
    (element: HTMLElement | null) => {
      if (element) renderMath(element, tex, display);
    },
    [tex, display],
  );
  const Tag = display ? "div" : "span";
  return <Tag ref={draw} className={cn(display && "my-1 overflow-x-auto", className)} />;
}
