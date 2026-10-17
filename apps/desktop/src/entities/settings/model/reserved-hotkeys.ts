import { hotkey, type Hotkey } from "../../../shared/lib/hotkeys";

export const UNDO_HOTKEY = hotkey("z", { mod: true });
export const REDO_HOTKEYS = [hotkey("z", { mod: true, shift: true }), hotkey("y", { mod: true })];
export const SEARCH_SETTINGS_HOTKEY = hotkey("f", { mod: true });
export const LEAVE_SETTINGS_HOTKEY = hotkey("Escape");
export const ZOOM_IN_HOTKEYS = [
  hotkey("=", { mod: true }),
  hotkey("+", { mod: true }),
  hotkey("+", { mod: true, shift: true }),
];
export const ZOOM_OUT_HOTKEY = hotkey("-", { mod: true });
export const RESET_ZOOM_HOTKEY = hotkey("0", { mod: true });

const TEXT_EDITING = [
  ...["a", "c", "v", "x", "y", "z"].map((key) => hotkey(key, { mod: true })),
  ...["a", "c", "v", "y", "z"].map((key) => hotkey(key, { mod: true, shift: true })),
];

export const RESERVED_HOTKEYS: { hotkey: Hotkey; reason: string }[] = [
  ...TEXT_EDITING.map((reserved) => ({ hotkey: reserved, reason: "That shortcut is used for editing text." })),
  { hotkey: SEARCH_SETTINGS_HOTKEY, reason: "That shortcut searches settings." },
  ...[...ZOOM_IN_HOTKEYS, ZOOM_OUT_HOTKEY, RESET_ZOOM_HOTKEY].map((reserved) => ({
    hotkey: reserved,
    reason: "That shortcut zooms documents.",
  })),
];
