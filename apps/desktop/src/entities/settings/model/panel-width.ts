import type { Settings } from "../../../shared/api/settings";
import { clamp } from "../../../shared/lib/clamp";
import { createStore, useStore } from "../../../shared/lib/store";
import type { PanelWidthControl } from "../../../shared/ui/panel-resize-handle";
import { getSettings, updateSettings, useSettings } from "./settings-store";

type PanelWidthKey = "sidebarWidth" | "chatWidth";

export function panelWidth(key: PanelWidthKey, limits: PanelWidthControl["limits"]) {
  const draftWidth = createStore<number | null>(null);
  const fitWidth = (width: number) => Math.round(clamp(width, limits.min, limits.max));

  return {
    limits,
    savedWidth: () => getSettings()[key],
    useWidth: () => {
      const draft = useStore(draftWidth);
      const saved = useSettings()[key];
      return draft ?? saved;
    },
    useResizing: () => useStore(draftWidth) !== null,
    preview: (width: number) => draftWidth.set(fitWidth(width)),
    commit: (width = draftWidth.get()) => {
      draftWidth.set(null);
      if (width === null || fitWidth(width) === getSettings()[key]) return;
      const changes: Partial<Settings> = {};
      changes[key] = fitWidth(width);
      updateSettings(changes);
    },
    cancel: () => draftWidth.set(null),
  };
}
