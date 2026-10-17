import { File, FileText, Folder, Image, Settings } from "lucide-react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import { entryName, findEntry } from "../../../entities/note/model/note-tree";
import type { Entry } from "../../../shared/api/notes";
import { entryPath } from "../../../shared/config/routes";
import { navigate } from "../../../shared/lib/hash-router";
import type { AppLink } from "../lib/app-links";

const ICON = "size-3 shrink-0 self-center";

function MentionIcon({ entry, link }: { entry: Entry | undefined; link: AppLink }) {
  if (link.kind === "page") return <Settings className={ICON} />;
  if (link.ref.kind === "note") return <FileText className={ICON} />;
  if (link.ref.kind === "folder") return <Folder className={ICON} />;
  return entry?.kind === "media" && entry.mediaType === "image" ? (
    <Image className={ICON} />
  ) : (
    <File className={ICON} />
  );
}

export function AppMention({ link, label }: { link: AppLink; label: string }) {
  const entries = useEntries();
  const entry = link.kind === "entry" ? findEntry(entries, link.ref) : undefined;
  const missing = link.kind === "entry" && !entry;
  const name = entry ? entryName(entry) : label || (link.kind === "page" ? "Settings" : "Missing item");
  const path = link.kind === "page" ? link.path : entryPath(link.ref);

  return (
    <button
      type="button"
      disabled={missing}
      onClick={() => navigate(path)}
      className="inline-flex max-w-full items-baseline gap-1 rounded bg-foreground/8 px-1 align-baseline text-[0.95em] font-medium hover:bg-foreground/14 disabled:font-normal disabled:text-muted-foreground disabled:line-through"
    >
      <MentionIcon entry={entry} link={link} />
      <span className="truncate">{name}</span>
    </button>
  );
}
