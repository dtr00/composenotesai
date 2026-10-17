import { Bot } from "lucide-react";
import { useHotkey } from "../../../entities/settings/model/keybindings";
import { Shortcut } from "../../../shared/ui/shortcut";
import { TitleBarButton } from "../../../shared/ui/title-bar-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { toggleChat, useChatOpen } from "../model/chat-panel";

export function AgentButton() {
  const open = useChatOpen();
  const hotkey = useHotkey("toggleChat");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <TitleBarButton
            className="mr-1"
            aria-label={open ? "Close AI chat" : "Open AI chat"}
            aria-pressed={open}
            onClick={toggleChat}
          />
        }
      >
        <Bot />
      </TooltipTrigger>
      <TooltipContent>
        AI chat
        <Shortcut hotkey={hotkey} />
      </TooltipContent>
    </Tooltip>
  );
}
