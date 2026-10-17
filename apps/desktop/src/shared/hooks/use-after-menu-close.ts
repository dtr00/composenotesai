import { useRef } from "react";

export function useAfterMenuClose() {
  const pending = useRef<(() => void) | null>(null);

  const afterClose = (action: () => void) => {
    pending.current = action;
  };

  const onOpenChangeComplete = (open: boolean) => {
    if (open) return;
    pending.current?.();
    pending.current = null;
  };

  return { afterClose, onOpenChangeComplete };
}
