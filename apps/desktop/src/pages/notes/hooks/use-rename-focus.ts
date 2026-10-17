import { useRef } from "react";

type AfterClose = "rename" | "stay";

export function useRenameFocus() {
  const input = useRef<HTMLInputElement>(null);
  const afterClose = useRef<AfterClose | null>(null);

  const requestRename = () => {
    afterClose.current = "rename";
  };

  const leaveFocus = () => {
    afterClose.current = "stay";
  };

  const finalFocus = (): HTMLElement | boolean => {
    const next = afterClose.current;
    afterClose.current = null;
    if (next === "stay") return false;
    if (next !== "rename" || !input.current) return true;
    input.current.select();
    return input.current;
  };

  return { input, requestRename, leaveFocus, finalFocus };
}
