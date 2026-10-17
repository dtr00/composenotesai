import { Folder as FolderIcon, FolderOpen } from "lucide-react";
import { useEntries, useFolder, useNoteListStatus } from "../../../entities/note/model/note-list-store";
import { childrenOf } from "../../../entities/note/model/note-tree";
import { useRef } from "react";
import type { FolderEntry, MediaEntry, NoteEntry } from "../../../shared/api/notes";
import { entryPath, notePath } from "../../../shared/config/routes";
import { Link } from "../../../shared/ui/link";
import { useNotePreview } from "../hooks/use-note-preview";
import { revealFolder } from "../model/tree-store";
import { EntryIcon } from "../../../entities/note/ui/entry-icon";
import { NoteIcon, NotePreview } from "./note-preview";

const ENTRY_LINK = "w-full justify-start [&_svg]:text-muted-foreground";

function FolderLink({ folder }: { folder: FolderEntry }) {
  return (
    <li>
      <Link
        href={`#${entryPath(folder)}`}
        variant="ghost"
        size="lg"
        className={ENTRY_LINK}
        onClick={() => revealFolder(folder.id)}
      >
        <FolderIcon />
        <span className="truncate">{folder.name}</span>
      </Link>
    </li>
  );
}

function MediaRow({ media }: { media: MediaEntry }) {
  return (
    <li>
      <Link href={`#${entryPath(media)}`} variant="ghost" size="lg" className={ENTRY_LINK}>
        <EntryIcon type={media.mediaType} />
        <span className="truncate">{media.name}</span>
      </Link>
    </li>
  );
}

function NoteLink({ note }: { note: NoteEntry }) {
  const title = useRef<HTMLSpanElement>(null);
  const { previewable, previewing, hoverProps } = useNotePreview(note.id);
  return (
    <li {...hoverProps}>
      <Link href={`#${notePath(note.id)}`} variant="ghost" size="lg" className={ENTRY_LINK}>
        <NoteIcon previewable={previewable} format={note.format} />
        <span ref={title} className="truncate">
          {note.title}
        </span>
      </Link>
      <NotePreview id={note.id} open={previewing} anchor={title} />
    </li>
  );
}

export function FolderPage({ id }: { id: number }) {
  const folder = useFolder(id);
  const contents = childrenOf(useEntries(), id);
  const { loading } = useNoteListStatus();

  if (!folder) return loading ? null : <p className="m-auto text-muted-foreground">This folder no longer exists.</p>;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-6">
      <h1 className="flex items-center gap-2 text-base font-medium">
        <FolderOpen className="size-5 shrink-0 text-muted-foreground" />
        <span className="truncate">{folder.name}</span>
      </h1>
      {contents.length === 0 ? (
        <p className="text-xs text-muted-foreground">This folder is empty.</p>
      ) : (
        <ul className="flex flex-col gap-px">
          {contents.map((entry) => {
            const key = `${entry.kind}-${entry.id}`;
            switch (entry.kind) {
              case "folder":
                return <FolderLink key={key} folder={entry} />;
              case "media":
                return <MediaRow key={key} media={entry} />;
              case "note":
                return <NoteLink key={key} note={entry} />;
            }
          })}
        </ul>
      )}
    </div>
  );
}
