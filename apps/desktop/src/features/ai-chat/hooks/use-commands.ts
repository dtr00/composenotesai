import { useState, type KeyboardEvent } from "react";
import { CHAT_COMMANDS, type ChatCommand } from "../config/chat-commands";
import { typedCommands } from "../lib/chat-command";
import { focusComposer } from "../model/chat-panel";
import { setDraft } from "../model/chat-store";

export function useCommands(draft: string) {
  const [highlighted, setHighlighted] = useState(0);
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null);
  const suggestions = draft === dismissedDraft ? [] : typedCommands(draft, CHAT_COMMANDS);
  const active = Math.min(highlighted, Math.max(suggestions.length - 1, 0));

  const pick = (command: ChatCommand) => {
    setDraft(`/${command.name} `);
    setHighlighted(0);
    focusComposer();
  };

  const consumeKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (suggestions.length === 0 || event.nativeEvent.isComposing) return false;
    if (event.key === "ArrowDown") setHighlighted((active + 1) % suggestions.length);
    else if (event.key === "ArrowUp") setHighlighted((active - 1 + suggestions.length) % suggestions.length);
    else if (event.key === "Enter" || event.key === "Tab") pick(suggestions[active]);
    else if (event.key === "Escape") setDismissedDraft(draft);
    else return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  return { suggestions, highlighted: active, setHighlighted, pick, consumeKey };
}
