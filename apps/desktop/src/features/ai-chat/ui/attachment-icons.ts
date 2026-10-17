import { FileText, FileType, Folder, type LucideIcon } from "lucide-react";
import type { ChatAttachment } from "../model/conversation";

export const ATTACHMENT_ICONS: Record<ChatAttachment["kind"], LucideIcon> = {
  note: FileText,
  folder: Folder,
  file: FileType,
};
