import { useState, type KeyboardEvent } from "react";
import {
  HOTKEY_ACTIONS,
  HOTKEY_GROUPS,
  hotkeyProblem,
  isCustomHotkey,
  resetHotkeys,
  setHotkey,
  useHotkey,
  type HotkeyAction,
} from "../../../entities/settings/model/keybindings";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { hotkeyFromEvent } from "../../../shared/lib/hotkeys";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Shortcut } from "../../../shared/ui/shortcut";
import { keybindingSettingId } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function KeybindingRow({ action, label }: { action: HotkeyAction; label: string }) {
  const custom = isCustomHotkey(action, useSettings());
  const hotkey = useHotkey(action);
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const stop = () => {
    setRecording(false);
    setProblem(null);
  };

  const record = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    const pressed = hotkeyFromEvent(event.nativeEvent);
    if (!pressed) return;
    if (pressed.key === "Escape" && !pressed.mod && !pressed.alt && !pressed.shift) {
      stop();
      return;
    }
    const reason = hotkeyProblem(action, pressed);
    if (reason) {
      setProblem(reason);
      return;
    }
    setHotkey(action, pressed);
    stop();
  };

  return (
    <CardHeader id={keybindingSettingId(action)}>
      <div className="row-span-2 flex flex-col gap-1 self-center">
        <CardTitle>{label}</CardTitle>
        {problem && (
          <CardDescription role="alert" className="text-destructive">
            {problem}
          </CardDescription>
        )}
      </div>
      <CardAction className="flex items-center gap-1 self-center">
        {custom && !recording && (
          <Button variant="ghost" onClick={() => setHotkey(action, null)}>
            Reset
          </Button>
        )}
        <Button
          variant="ghost"
          className="h-auto p-1"
          aria-label={recording ? `Press a new shortcut for ${label}` : `Change the shortcut for ${label}`}
          aria-pressed={recording}
          onClick={() => (recording ? stop() : setRecording(true))}
          onKeyDown={record}
          onBlur={stop}
        >
          {recording ? <span className="text-muted-foreground">Press a shortcut</span> : <Shortcut hotkey={hotkey} />}
        </Button>
      </CardAction>
    </CardHeader>
  );
}

export function KeybindingsSection() {
  const customized = Object.keys(useSettings().keybindings).length > 0;

  return HOTKEY_GROUPS.map((group, i) => (
    <SettingsGroup
      key={group}
      name={`keybindings-${group.toLowerCase()}`}
      title={group}
      headerRow
      actions={
        i === 0 && (
          <Button variant="ghost" size="sm" disabled={!customized} onClick={resetHotkeys}>
            Reset to defaults
          </Button>
        )
      }
    >
      <Card size="sm">
        {HOTKEY_ACTIONS.filter((entry) => entry.group === group).map(({ action, label }) => (
          <KeybindingRow key={action} action={action} label={label} />
        ))}
      </Card>
    </SettingsGroup>
  ));
}
