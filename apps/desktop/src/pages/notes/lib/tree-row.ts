import type { CSSProperties } from "react";

const INDENT_PX = 20;
const ROW_PADDING_PX = 8;

export const indentPx = (depth: number) => ROW_PADDING_PX + depth * INDENT_PX;

const CHEVRON_CENTER_PX = 7;

export const guidePx = (level: number) => indentPx(level) + CHEVRON_CENTER_PX;

export const indentStyle = (depth: number): CSSProperties => ({ paddingLeft: indentPx(depth) });

export const ROW_ICONS = "[&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5";

export const RENAME_ROW = `flex h-7 w-full items-center gap-1.5 rounded-md border border-transparent bg-sidebar-accent bg-clip-padding pr-2 text-xs/relaxed font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-ring ring-inset ${ROW_ICONS}`;

export const RENAME_INPUT = "min-w-0 flex-1 bg-transparent outline-none select-text";
