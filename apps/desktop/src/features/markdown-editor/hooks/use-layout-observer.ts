import { useRef } from "react";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";

export function useLayoutObserver(onLayout: () => void) {
  const target = useRef<HTMLDivElement>(null);
  useMountEffect(() => {
    if (!target.current) return;
    const observer = new ResizeObserver(() => onLayout());
    observer.observe(target.current);
    return () => observer.disconnect();
  });
  return target;
}
