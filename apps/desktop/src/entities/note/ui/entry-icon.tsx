import { FileText, FileTypeCorner, Film, Folder, Image, type LucideIcon } from "lucide-react";
import type { EntryType } from "../../../shared/api/notes";

const ICONS: Record<EntryType, LucideIcon> = {
  note: FileText,
  folder: Folder,
  image: Image,
  video: Film,
  document: FileTypeCorner,
};

export function EntryIcon({ type, className }: { type: EntryType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon aria-hidden className={className} />;
}
