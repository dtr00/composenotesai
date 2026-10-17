import { Paperclip } from "lucide-react";
import { useRef, type RefObject } from "react";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import type { MentionTrigger } from "../lib/mention";
import { attachFiles } from "../model/attachments";

interface AttachMenuProps {
  onMention: (trigger: MentionTrigger) => void;
  focusAfter: RefObject<HTMLTextAreaElement | null>;
}

export function AttachMenu({ onMention, focusAfter }: AttachMenuProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void attachFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Attach" />}
              />
            }
          >
            <Paperclip className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Attach notes, folders or files</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" side="top" className="w-44" finalFocus={focusAfter}>
          <DropdownMenuItem onClick={() => onMention("@")}>Attach a note</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMention("#")}>Attach a folder</DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInput.current?.click()}>Attach a file</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
