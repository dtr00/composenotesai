import type { MouseEvent } from "react";

export const UNFOCUSABLE = { tabIndex: -1, onMouseDown: (event: MouseEvent) => event.preventDefault() };
