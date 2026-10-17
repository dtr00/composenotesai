import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { renameChat, useChatTitle } from "../model/chat-store";

const TITLE = "h-[25px] min-w-0 flex-1 rounded-md px-1.5 text-left text-xs font-medium";

export function ChatTitle() {
  const title = useChatTitle();
  const [editing, setEditing] = useState(false);

  if (title === null) return <h2 className={`${TITLE} flex items-center`}>Compose AI</h2>;

  if (editing) {
    const finish = (input: HTMLInputElement, save: boolean) => {
      setEditing(false);
      if (save) void renameChat(input.value);
    };
    return (
      <input
        aria-label="Chat name"
        defaultValue={title}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => finish(event.currentTarget, true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(event.currentTarget, true);
          if (event.key === "Escape") {
            event.stopPropagation();
            finish(event.currentTarget, false);
          }
        }}
        className={`${TITLE} bg-background outline-none ring-1 ring-ring/50 select-text`}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${TITLE} truncate hover:bg-foreground/8`}
          />
        }
      >
        {title}
      </TooltipTrigger>
      <TooltipContent>Rename chat</TooltipContent>
    </Tooltip>
  );
}
