import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import { counted } from "../../../shared/lib/plural";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../shared/ui/collapsible";
import type { ChatAttachment } from "../model/conversation";
import { ATTACHMENT_ICONS } from "./attachment-icons";
import { FOLD_CHEVRON, FOLD_ICON, FOLD_TRIGGER } from "./fold-styles";

export function SentAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <Collapsible className="flex max-w-[80%] flex-col items-end self-end text-xs">
      <CollapsibleTrigger className={cn("group/attachments", FOLD_TRIGGER)}>
        <span className="truncate">{counted(attachments.length, "attachment")}</span>
        <ChevronRight
          className={cn(
            FOLD_CHEVRON,
            "group-hover/attachments:opacity-100 group-data-panel-open/attachments:rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 mr-[7px] flex max-w-full flex-col items-end gap-1.5 border-r pr-3">
        {attachments.map((attachment, index) => {
          const Icon = ATTACHMENT_ICONS[attachment.kind];
          return (
            <span
              key={`${attachment.kind}-${attachment.name}-${index}`}
              className="flex max-w-full items-center gap-1.5 text-muted-foreground"
            >
              <Icon className={FOLD_ICON} />
              <span className="truncate">{attachment.name}</span>
            </span>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
