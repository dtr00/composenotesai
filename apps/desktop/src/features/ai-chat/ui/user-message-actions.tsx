import { Undo2 } from "lucide-react";
import { useState } from "react";
import type { ChangeCounts } from "../lib/note-changes";
import { revertTo } from "../model/chat-store";
import type { UserMessage } from "../model/conversation";
import { PixelSnappedActionButton } from "./pixel-snapped-action-button";
import { CopyButton } from "./copy-button";
import { RevertDialog } from "./revert-dialog";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const sentLabel = (at: number) =>
  (new Date(at).toDateString() === new Date().toDateString() ? timeFormat : dateFormat).format(at);

interface UserMessageActionsProps {
  message: UserMessage;
  changes: ChangeCounts;
  running: boolean;
}

export function UserMessageActions({ message, changes, running }: UserMessageActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const canRevert = changes.notes > 0 && !running;

  return (
    <div className="flex items-center gap-0.5 self-end text-[11px] text-muted-foreground opacity-0 group-hover/message:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100">
      <span className="px-1 tabular-nums">{sentLabel(message.sentAt)}</span>
      <PixelSnappedActionButton
        icon={Undo2}
        label="Revert to before this message"
        hint="Revert note changes from here"
        disabled={!canRevert}
        onClick={() => setConfirming(true)}
      />
      <CopyButton text={message.text} label="Copy message" />
      <RevertDialog
        open={confirming}
        changes={changes}
        onOpenChange={setConfirming}
        onRevert={() => void revertTo(message.id)}
      />
    </div>
  );
}
