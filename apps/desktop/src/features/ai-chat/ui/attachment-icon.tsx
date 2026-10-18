import { FileText, FileType, Folder, PencilRuler } from "lucide-react";
import { isDrawing } from "../../../entities/note/lib/note-format";
import { useNoteFormat } from "../../../entities/note/model/note-list-store";

const ICONS = { note: FileText, folder: Folder, file: FileType };

interface AttachmentIconProps {
  attachment: { kind: "note" | "folder"; id: number } | { kind: "file" };
  className?: string;
}

export function AttachmentIcon({ attachment, className }: AttachmentIconProps) {
  const format = useNoteFormat(attachment.kind === "note" ? attachment.id : null);
  const Icon = isDrawing(format) ? PencilRuler : ICONS[attachment.kind];

  return <Icon className={className} />;
}
