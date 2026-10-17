import { useSyncExternalStore } from "react";
import { isDarkTheme, prefersDark } from "../lib/theme";
import { useSettings } from "../model/settings-store";

function subscribe(onChange: () => void) {
  prefersDark.addEventListener("change", onChange);
  return () => prefersDark.removeEventListener("change", onChange);
}

export function useDarkTheme(): boolean {
  const { theme } = useSettings();
  return isDarkTheme(
    theme,
    useSyncExternalStore(subscribe, () => prefersDark.matches),
  );
}
