import { createContext, useContext, type PointerEvent } from "react";
import type { Entry, EntryRef } from "../../../shared/api/notes";
import type { Drag, DropTarget } from "./use-tree-drag";

export interface TreeContextValue {
  selection: EntryRef[];
  drag: Drag | null;
  target: DropTarget | null;
  revealFolderId: number | null;
  hideTooltips: boolean;
  startDrag: (event: PointerEvent<HTMLElement>, entry: Entry) => void;
}

export const TreeContext = createContext<TreeContextValue | null>(null);

export function useTreeContext(): TreeContextValue {
  const tree = useContext(TreeContext);
  if (!tree) throw new Error("Tree rows must render inside a TreeContext.");
  return tree;
}
