import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { Bold, Code, Italic, Link, Strikethrough, Underline, type LucideIcon } from "lucide-react";
import { useHotkey, type EditorHotkeyAction } from "../../../entities/settings/model/keybindings";
import { Button } from "../../../shared/ui/button";
import { Shortcut } from "../../../shared/ui/shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { INLINE_ACTIONS, INLINE_FORMATS, type InlineAction } from "../lib/editor-formats";

const ICONS: Record<InlineAction, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  inlineCode: Code,
  link: Link,
};

function ItemShortcut({ action }: { action: EditorHotkeyAction }) {
  return <Shortcut hotkey={useHotkey(action)} />;
}

export function FormatToolbar({ view, state }: { view: EditorView; state: EditorState }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5">
      {INLINE_ACTIONS.map((action) => {
        const { label, run, active } = INLINE_FORMATS[action];
        const Icon = ICONS[action];
        return (
          <Tooltip key={label}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={label}
                  aria-pressed={active(state)}
                  className="aria-pressed:bg-foreground/10 aria-pressed:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(view)}
                />
              }
            >
              <Icon />
            </TooltipTrigger>
            <TooltipContent>
              {label}
              <ItemShortcut action={action} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
