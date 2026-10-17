import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { MONO } from "./monospace";
import { FOREGROUND_10, POPOVER_SURFACE } from "./popover-surface";

const MENU_GAP_PX = 8;
const menuTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": POPOVER_SURFACE,
  ".cm-tooltip.cm-tooltip-autocomplete.cm-tooltip-below": { marginTop: `${MENU_GAP_PX}px` },
  ".cm-tooltip.cm-tooltip-autocomplete.cm-tooltip-above": { marginTop: `${-MENU_GAP_PX}px` },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    maxHeight: "18rem",
    minWidth: "14rem",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    minHeight: "1.75rem",
    padding: "0.25rem 0.5rem",
    borderRadius: "var(--radius-md)",
    fontSize: "0.75rem",
    lineHeight: "1.625",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: FOREGROUND_10,
    color: "var(--popover-foreground)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section": {
    display: "block",
    padding: "0.5rem 0.5rem 0.25rem",
    border: "none",
    fontSize: "0.625rem",
    fontWeight: "500",
    color: "var(--muted-foreground)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > completion-section:not(:first-child)": {
    marginTop: "0.25rem",
    borderTop: `1px solid ${FOREGROUND_10}`,
  },
  ".cm-completionLabel": { flex: "1" },
  ".cm-completionDetail": {
    marginLeft: "auto",
    fontStyle: "normal",
    fontFamily: MONO,
    color: "var(--muted-foreground)",
  },
});

export const completionMenu = (sources: CompletionSource[]) => [
  autocompletion({
    override: sources,
    icons: false,
    closeOnBlur: true,
    maxRenderedOptions: 50,
    activateOnTypingDelay: 0,
    updateSyncTime: 0,
    interactionDelay: 0,
  }),
  menuTheme,
];
