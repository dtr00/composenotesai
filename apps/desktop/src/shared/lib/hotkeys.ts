import { isMacOS } from "./platform";

export interface Hotkey {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "AltGraph", "Meta", "OS", "CapsLock", "Fn"]);
const CODE_CHARACTER = /^(?:Key([A-Z])|Digit([0-9]))$/;
const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;
const STORED_HOTKEY = /^((?:(?:mod|alt|shift)\+)*)(.+)$/;

export const hotkey = (key: string, modifiers: Partial<Omit<Hotkey, "key">> = {}): Hotkey => ({
  key,
  mod: modifiers.mod ?? false,
  alt: modifiers.alt ?? false,
  shift: modifiers.shift ?? false,
});

function pressedKey(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const character = CODE_CHARACTER.exec(event.code);
  const shiftedDigit = event.shiftKey && character?.[2] !== undefined;
  if (character && (event.key === "Dead" || (isMacOS && event.altKey) || shiftedDigit))
    return (character[1] ?? character[2]).toLowerCase();
  if (event.key === "Dead" || event.key === "Unidentified") return null;
  if (event.key === " ") return "space";
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function hotkeyFromEvent(event: KeyboardEvent): Hotkey | null {
  const key = pressedKey(event);
  const otherModifier = isMacOS ? event.ctrlKey : event.metaKey;
  if (key === null || otherModifier) return null;
  return { key, mod: isMacOS ? event.metaKey : event.ctrlKey, alt: event.altKey, shift: event.shiftKey };
}

export const sameHotkey = (a: Hotkey, b: Hotkey) =>
  a.key === b.key && a.mod === b.mod && a.alt === b.alt && a.shift === b.shift;

export const isFunctionKey = (key: string) => FUNCTION_KEY.test(key);

export const formatHotkey = ({ key, mod, alt, shift }: Hotkey) =>
  [mod && "mod", alt && "alt", shift && "shift", key].filter(Boolean).join("+");

export function parseHotkey(text: string): Hotkey | null {
  const match = STORED_HOTKEY.exec(text);
  if (!match) return null;
  const modifiers = match[1].split("+");
  return hotkey(match[2], {
    mod: modifiers.includes("mod"),
    alt: modifiers.includes("alt"),
    shift: modifiers.includes("shift"),
  });
}
