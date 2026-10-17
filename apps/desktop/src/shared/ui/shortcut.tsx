import { ArrowBigUp, Command, Option } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { Hotkey } from "../lib/hotkeys";
import { isMacOS } from "../lib/platform";
import { Kbd, KbdGroup } from "./kbd";

const MOD = isMacOS ? <Command role="img" aria-label="Command" className="size-3" /> : "Ctrl";
const ALT = isMacOS ? <Option role="img" aria-label="Option" className="size-3" /> : "Alt";
const SHIFT = isMacOS ? <ArrowBigUp role="img" aria-label="Shift" className="size-3" /> : "Shift";

const KEY_LABELS: Record<string, string> = {
  space: "Space",
  Escape: "Esc",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Del",
  Tab: "Tab",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  PageUp: "PgUp",
  PageDown: "PgDn",
};

const keyLabel = (key: string) => KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);

function keyCaps({ key, mod, alt, shift }: Hotkey): ReactNode[] {
  const modifiers = isMacOS ? [alt && ALT, shift && SHIFT, mod && MOD] : [mod && MOD, alt && ALT, shift && SHIFT];
  return [...modifiers.filter(Boolean), keyLabel(key)];
}

export function Shortcut({ hotkey, className }: { hotkey: Hotkey; className?: string }) {
  return (
    <KbdGroup className={className}>
      {keyCaps(hotkey).map((label, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="font-sans text-[0.625rem] text-muted-foreground">+</span>}
          <Kbd>{label}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  );
}
