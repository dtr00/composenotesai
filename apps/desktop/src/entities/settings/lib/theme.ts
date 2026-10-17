import type { Theme } from "../../../shared/api/settings";
import { withoutTransitions } from "../../../shared/lib/without-transitions";

export const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

export const isDarkTheme = (theme: Theme, systemDark: boolean) =>
  theme === "dark" || (theme === "system" && systemDark);

export function followTheme(theme: Theme): () => void {
  const apply = () =>
    withoutTransitions(() =>
      document.documentElement.classList.toggle("dark", isDarkTheme(theme, prefersDark.matches)),
    );
  apply();
  if (theme !== "system") return () => {};
  prefersDark.addEventListener("change", apply);
  return () => prefersDark.removeEventListener("change", apply);
}
