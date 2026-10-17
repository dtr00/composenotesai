import { useState, type KeyboardEvent } from "react";
import { useSettings } from "../../../entities/settings/model/settings-store";
import type { BoundShortcut, ShortcutBinding } from "../../../shared/api/voice";
import { formatHotkey, hotkeyFromEvent, parseHotkey } from "../../../shared/lib/hotkeys";
import { Button } from "../../../shared/ui/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Shortcut } from "../../../shared/ui/shortcut";
import { SETTING_IDS } from "../model/settings-search";
import { changeShortcut, setUpShortcut, useVoice } from "../model/voice";

const ROWS = {
  record: {
    id: SETTING_IDS.recordShortcut,
    title: "Recording shortcut",
    description: "Start or stop a voice note from anywhere, even when the app is in the background.",
    holdDescription: "Hold to record a voice note from anywhere, even when the app is in the background.",
  },
  cancel: {
    id: SETTING_IDS.cancelShortcut,
    title: "Cancel shortcut",
    description: "Discard the voice note being recorded.",
    holdDescription: null,
  },
} as const;

interface ShortcutRowProps {
  binding: ShortcutBinding;
  bound: BoundShortcut;
  editable: boolean;
  busy: boolean;
  hold: boolean;
}

export function ShortcutRow({ binding, bound, editable, busy, hold }: ShortcutRowProps) {
  const [capturing, setCapturing] = useState(false);
  const row = ROWS[binding];
  const hotkey = bound.hotkey ? parseHotkey(bound.hotkey) : null;
  const custom = bound.hotkey !== bound.defaultHotkey;

  const capture = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopPropagation();
    const pressed = hotkeyFromEvent(event.nativeEvent);
    if (!pressed) return;
    setCapturing(false);
    const bareEscape = pressed.key === "Escape" && !pressed.mod && !pressed.alt && !pressed.shift;
    if (bareEscape && binding === "record") return;
    void changeShortcut(binding, formatHotkey(pressed));
  };

  return (
    <CardHeader id={row.id}>
      <CardTitle>{row.title}</CardTitle>
      <CardDescription>{(hold && row.holdDescription) || row.description}</CardDescription>
      <CardAction className="flex items-center gap-1 self-center">
        {editable && custom && !capturing && (
          <Button variant="ghost" disabled={busy} onClick={() => void changeShortcut(binding, null)}>
            Reset
          </Button>
        )}
        <Button
          variant="ghost"
          className="h-auto p-1"
          disabled={!editable || busy}
          aria-label={capturing ? `Press a new ${row.title.toLowerCase()}` : `Change the ${row.title.toLowerCase()}`}
          aria-pressed={capturing}
          onClick={() => setCapturing(!capturing)}
          onKeyDown={capture}
          onBlur={() => setCapturing(false)}
        >
          {capturing ? (
            <span className="text-muted-foreground">Press a shortcut</span>
          ) : hotkey ? (
            <Shortcut hotkey={hotkey} />
          ) : (
            <span className="text-muted-foreground">{bound.description ?? "Not set"}</span>
          )}
        </Button>
      </CardAction>
    </CardHeader>
  );
}

export function VoiceShortcutRows() {
  const { shortcuts, settingUpShortcut } = useVoice();
  const hold = useSettings().holdToRecord;
  if (!shortcuts) return null;

  if (shortcuts.needsSetup)
    return (
      <CardHeader id={SETTING_IDS.recordShortcut}>
        <CardTitle>Recording shortcuts</CardTitle>
        <CardDescription>
          Record or cancel a voice note from anywhere, even when the app is in the background. Your desktop asks you to
          confirm the shortcuts.
        </CardDescription>
        <CardAction className="self-center">
          <Button variant="outline" disabled={settingUpShortcut} onClick={() => void setUpShortcut()}>
            {settingUpShortcut ? "Waiting for your desktop" : "Set up"}
          </Button>
        </CardAction>
      </CardHeader>
    );

  return (
    <>
      <ShortcutRow
        binding="record"
        bound={shortcuts.record}
        editable={shortcuts.editable}
        busy={settingUpShortcut}
        hold={hold}
      />
      {!shortcuts.editable && (
        <CardHeader>
          <CardTitle>Desktop shortcuts</CardTitle>
          <CardDescription>Your desktop manages these shortcuts.</CardDescription>
          <CardAction className="self-center">
            <Button variant="outline" disabled={settingUpShortcut} onClick={() => void setUpShortcut()}>
              {settingUpShortcut ? "Opening settings" : "Change in desktop settings"}
            </Button>
          </CardAction>
        </CardHeader>
      )}
    </>
  );
}
