export interface CellAddress {
  row: number;
  column: number;
}

export type CaretPlacement = "start" | "end" | "all";

export interface CellFocus extends CellAddress {
  placement: CaretPlacement;
}

export const cellSelector = ({ row, column }: CellAddress) => `[data-row="${row}"][data-column="${column}"]`;

export function focusCell(cell: HTMLElement, placement: CaretPlacement) {
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  if (placement !== "all") range.collapse(placement === "start");
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function caretAtEdge(cell: HTMLElement, edge: "start" | "end") {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const caret = selection.getRangeAt(0);
  const outside = document.createRange();
  outside.selectNodeContents(cell);
  if (edge === "start") outside.setEnd(caret.startContainer, caret.startOffset);
  else outside.setStart(caret.endContainer, caret.endOffset);
  return outside.toString().length === 0;
}
