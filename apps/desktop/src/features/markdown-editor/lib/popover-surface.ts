export const FOREGROUND_10 = "color-mix(in oklab, var(--foreground) 10%, transparent)";

export const POPOVER_SURFACE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "none",
  borderRadius: "var(--radius-lg)",
  boxShadow: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1), 0 0 0 1px ${FOREGROUND_10}`,
  padding: "0.25rem",
};
