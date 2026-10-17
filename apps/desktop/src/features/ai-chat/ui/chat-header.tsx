import { History, SquarePen, Trash2, X } from "lucide-react";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { closeChatPanel, focusComposer } from "../model/chat-panel";
import { newChat, openSavedChat, refreshChatHistory, removeSavedChat, useChat } from "../model/chat-store";
import { ChatTitle } from "./chat-title";
import { IconActionButton } from "./icon-action-button";

const HEADER_BUTTON = "size-[25px]";

function HistoryMenu() {
  const { history, id } = useChat();

  return (
    <DropdownMenu onOpenChange={(open) => open && void refreshChatHistory()}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className={HEADER_BUTTON} aria-label="Chat history" />}
            />
          }
        >
          <History className="size-[15px]" />
        </TooltipTrigger>
        <TooltipContent>Chat history</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="max-h-80 w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{history.length === 0 ? "No saved chats yet" : "Recent chats"}</DropdownMenuLabel>
          {history.map((chat) => (
            <DropdownMenuItem
              key={chat.id}
              className="group/chat pr-1"
              data-current={chat.id === id || undefined}
              onClick={() => void openSavedChat(chat.id)}
            >
              <span className="min-w-0 flex-1 truncate group-data-current/chat:font-medium">{chat.title}</span>
              <button
                type="button"
                aria-label={`Delete “${chat.title}”`}
                className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 group-data-highlighted/chat:opacity-100 hover:bg-foreground/10 hover:text-destructive!"
                onClick={(event) => {
                  event.stopPropagation();
                  void removeSavedChat(chat.id);
                }}
              >
                <Trash2 />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatHeader() {
  return (
    <div className="flex shrink-0 items-center gap-0.5 px-2 py-1.5 select-none">
      <HistoryMenu />
      <ChatTitle />
      <IconActionButton
        label="New chat"
        variant="ghost"
        className={HEADER_BUTTON}
        onClick={() => {
          newChat();
          focusComposer();
        }}
      >
        <SquarePen className="size-[15px]" />
      </IconActionButton>
      <IconActionButton label="Close" variant="ghost" className={HEADER_BUTTON} onClick={closeChatPanel}>
        <X className="size-[15px]" />
      </IconActionButton>
    </div>
  );
}
