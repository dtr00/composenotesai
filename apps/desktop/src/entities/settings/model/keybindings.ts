import type { Settings } from "../../../shared/api/settings";
import {
  formatHotkey,
  hotkey,
  hotkeyFromEvent,
  isFunctionKey,
  parseHotkey,
  sameHotkey,
  type Hotkey,
} from "../../../shared/lib/hotkeys";
import { isMacOS, isWindows } from "../../../shared/lib/platform";
import { RESERVED_HOTKEYS } from "./reserved-hotkeys";
import { getSettings, updateSettings, useSettings } from "./settings-store";

export type AppHotkeyAction =
  | "newNote"
  | "newExcalidrawNote"
  | "newTab"
  | "openBrowser"
  | "closeTab"
  | "toggleSidebar"
  | "toggleChat"
  | "openSettings";

export type EditorHotkeyAction =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "inlineCode"
  | "link"
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletedList"
  | "numberedList"
  | "todoList"
  | "toggleTodo";

export type DictationHotkeyAction = "dictate";

export type HotkeyAction = AppHotkeyAction | EditorHotkeyAction | DictationHotkeyAction;

export const HOTKEY_GROUPS = ["General", "Layout", "Navigation", "Formatting", "Blocks", "Voice"] as const;

type HotkeyGroup = (typeof HOTKEY_GROUPS)[number];

interface ActionInfo<A extends HotkeyAction = HotkeyAction> {
  action: A;
  label: string;
  group: HotkeyGroup;
  fallback: Hotkey;
}

const APP_HOTKEYS: ActionInfo<AppHotkeyAction>[] = [
  { action: "newNote", label: "New note", group: "General", fallback: hotkey("n", { mod: true }) },
  {
    action: "newExcalidrawNote",
    label: "New Excalidraw note",
    group: "General",
    fallback: hotkey("n", { mod: true, shift: true }),
  },
  { action: "newTab", label: "New tab", group: "General", fallback: hotkey("t", { mod: true }) },
  {
    action: "openBrowser",
    label: "Open browser",
    group: "General",
    fallback: hotkey("o", { mod: true, shift: true }),
  },
  { action: "closeTab", label: "Close tab", group: "General", fallback: hotkey("w", { mod: true }) },
  {
    action: "toggleSidebar",
    label: "Toggle sidebar",
    group: "Layout",
    fallback: hotkey("b", { mod: true, shift: true }),
  },
  { action: "toggleChat", label: "Toggle AI chat", group: "Layout", fallback: hotkey("l", { mod: true }) },
  { action: "openSettings", label: "Open settings", group: "Navigation", fallback: hotkey(",", { mod: true }) },
];

const EDITOR_HOTKEYS: ActionInfo<EditorHotkeyAction>[] = [
  { action: "bold", label: "Bold", group: "Formatting", fallback: hotkey("b", { mod: true }) },
  { action: "italic", label: "Italic", group: "Formatting", fallback: hotkey("i", { mod: true }) },
  { action: "underline", label: "Underline", group: "Formatting", fallback: hotkey("u", { mod: true }) },
  {
    action: "strikethrough",
    label: "Strikethrough",
    group: "Formatting",
    fallback: hotkey("x", { mod: true, shift: true }),
  },
  { action: "inlineCode", label: "Inline code", group: "Formatting", fallback: hotkey("e", { mod: true }) },
  { action: "link", label: "Link", group: "Formatting", fallback: hotkey("k", { mod: true }) },
  { action: "text", label: "Text", group: "Blocks", fallback: hotkey("0", { mod: true, alt: true }) },
  { action: "heading1", label: "Heading 1", group: "Blocks", fallback: hotkey("1", { mod: true, alt: true }) },
  { action: "heading2", label: "Heading 2", group: "Blocks", fallback: hotkey("2", { mod: true, alt: true }) },
  { action: "heading3", label: "Heading 3", group: "Blocks", fallback: hotkey("3", { mod: true, alt: true }) },
  {
    action: "numberedList",
    label: "Numbered list",
    group: "Blocks",
    fallback: hotkey("7", { mod: true, shift: true }),
  },
  {
    action: "bulletedList",
    label: "Bulleted list",
    group: "Blocks",
    fallback: hotkey("8", { mod: true, shift: true }),
  },
  { action: "todoList", label: "To-do list", group: "Blocks", fallback: hotkey("9", { mod: true, shift: true }) },
  { action: "toggleTodo", label: "Check or uncheck to-do", group: "Blocks", fallback: hotkey("Enter", { mod: true }) },
];

const DICTATION_HOTKEYS: ActionInfo<DictationHotkeyAction>[] = [
  {
    action: "dictate",
    label: "Hold to dictate",
    group: "Voice",
    fallback: isWindows ? hotkey("d", { mod: true, shift: true }) : hotkey("r", { alt: true }),
  },
];

export const HOTKEY_ACTIONS: ActionInfo[] = [...APP_HOTKEYS, ...EDITOR_HOTKEYS, ...DICTATION_HOTKEYS];

const info = (action: HotkeyAction) => HOTKEY_ACTIONS.find((entry) => entry.action === action)!;

export const hotkeyLabel = (action: HotkeyAction) => info(action).label;

export function hotkeyFor(action: HotkeyAction, settings: Settings = getSettings()): Hotkey {
  const stored = settings.keybindings[action];
  return (stored && parseHotkey(stored)) || info(action).fallback;
}

export const useHotkey = (action: HotkeyAction) => hotkeyFor(action, useSettings());

export const isCustomHotkey = (action: HotkeyAction, settings: Settings) => action in settings.keybindings;

export function hotkeyProblem(action: HotkeyAction, candidate: Hotkey): string | null {
  if (!candidate.mod && !candidate.alt && !isFunctionKey(candidate.key))
    return isMacOS ? "Include Command or Option." : "Include Ctrl or Alt.";
  const reserved = RESERVED_HOTKEYS.find((entry) => sameHotkey(entry.hotkey, candidate));
  if (reserved) return reserved.reason;
  const taken = HOTKEY_ACTIONS.find(
    (entry) => entry.action !== action && sameHotkey(hotkeyFor(entry.action), candidate),
  );
  return taken ? `Already used by ${taken.label}.` : null;
}

export function setHotkey(action: HotkeyAction, next: Hotkey | null) {
  const keybindings = Object.fromEntries(
    Object.entries(getSettings().keybindings).filter(([stored]) => stored !== action),
  );
  if (next && !sameHotkey(next, info(action).fallback)) keybindings[action] = formatHotkey(next);
  updateSettings({ keybindings });
}

export const resetHotkeys = () => updateSettings({ keybindings: {} });

function pressedAction<A extends HotkeyAction>(event: KeyboardEvent, actions: ActionInfo<A>[]): A | null {
  const pressed = hotkeyFromEvent(event);
  if (!pressed) return null;
  return actions.find((entry) => sameHotkey(hotkeyFor(entry.action), pressed))?.action ?? null;
}

export const appHotkeys = (settings: Settings) =>
  APP_HOTKEYS.map(({ action }) => ({ action, ...hotkeyFor(action, settings) }));

export const isAppHotkeyAction = (action: string): action is AppHotkeyAction =>
  APP_HOTKEYS.some((entry) => entry.action === action);

export const pressedEditorAction = (event: KeyboardEvent) => pressedAction(event, EDITOR_HOTKEYS);

export function listenForHotkeys(handlers: Record<AppHotkeyAction, () => void>) {
  window.addEventListener("keydown", (event) => {
    const action = pressedAction(event, APP_HOTKEYS);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) handlers[action]();
  });
}
