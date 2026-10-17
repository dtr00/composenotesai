import { X } from "lucide-react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "../../../shared/ui/attachment";
import { removeAttachment, usePendingAttachments } from "../model/attachments";
import { ATTACHMENT_ICONS } from "./attachment-icons";

export function PendingAttachments() {
  const attachments = usePendingAttachments();
  if (attachments.length === 0) return null;

  return (
    <AttachmentGroup className="flex-wrap gap-1.5 overflow-visible py-0">
      {attachments.map((attachment, index) => {
        const Icon = ATTACHMENT_ICONS[attachment.kind];
        return (
          <Attachment
            key={
              attachment.kind === "file" ? `file-${attachment.name}-${index}` : `${attachment.kind}-${attachment.id}`
            }
            size="xs"
            className="min-w-0 gap-1 bg-transparent has-data-[slot=attachment-media]:py-0.5 has-data-[slot=attachment-media]:pr-0.5 has-data-[slot=attachment-media]:pl-1.5"
          >
            <AttachmentMedia className="bg-transparent group-data-[size=xs]/attachment:w-4">
              <Icon className="size-3.5" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle className="max-w-48 truncate">{attachment.name}</AttachmentTitle>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(index)}>
                <X />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        );
      })}
    </AttachmentGroup>
  );
}
