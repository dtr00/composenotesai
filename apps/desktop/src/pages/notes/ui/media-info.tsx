import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import { folderIndex } from "../../../entities/note/model/note-tree";
import { MEDIA_LABELS } from "../../../entities/note/lib/media-labels";
import { mediaInfo, mediaSource, type MediaInfo, type MediaSummary } from "../../../shared/api/notes";
import { mediaFormatLabel } from "../../../shared/config/media-types";
import { notePath } from "../../../shared/config/routes";
import { showError } from "../../../shared/lib/error-toast";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { formatDuration } from "../../../shared/lib/format-duration";
import { Button } from "../../../shared/ui/button";
import { Link } from "../../../shared/ui/link";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "../../../shared/ui/popover";
import { measureMedia, type MediaDimensions } from "../lib/media-dimensions";

const PENDING = "…";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const durationText = (seconds: number) => (Number.isFinite(seconds) ? formatDuration(seconds) : "Unknown");

interface Details {
  info: MediaInfo;
  size: MediaDimensions | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function LinkedNotes({ notes }: { notes: MediaInfo["notes"] }) {
  if (notes.length === 0) return <span className="text-muted-foreground">No notes</span>;
  return (
    <ul className="flex flex-col items-start gap-0.5">
      {notes.map((note) => (
        <li key={note.id} className="max-w-full">
          <Link href={`#${notePath(note.id)}`} className="h-auto max-w-full justify-start truncate p-0 text-xs">
            {note.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MediaInfoButton({ media, className }: { media: MediaSummary; className?: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const { trail } = folderIndex(useEntries());
  const folder = trail(media.parentId)
    .map((entry) => entry.name)
    .join(" / ");
  const noun = MEDIA_LABELS[media.mediaType];

  const load = () => {
    const src = mediaSource(media.id);
    Promise.all([mediaInfo(media.id), measureMedia(src, media.mediaType)]).then(
      ([info, size]) => setDetails({ info, size }),
      (error: unknown) => showError(error),
    );
  };

  const { info, size } = details ?? {};

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) load();
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" className={className} aria-label={`${noun} info`} />}
      >
        <Info className="size-[15px]" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 gap-3">
        <PopoverHeader>
          <PopoverTitle className="truncate">{media.name}</PopoverTitle>
        </PopoverHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          <Row label="Type">{mediaFormatLabel(media.mime) ?? "Unknown"}</Row>
          <Row label="Size">{formatBytes(media.bytes)}</Row>
          {media.mediaType !== "document" && (
            <Row label="Dimensions">{size ? `${size.width} × ${size.height}` : details ? "Unknown" : PENDING}</Row>
          )}
          {media.mediaType === "video" && (
            <Row label="Duration">
              {size?.duration != null ? durationText(size.duration) : details ? "Unknown" : PENDING}
            </Row>
          )}
          <Row label="Created">{info ? dateTime.format(info.createdAt) : PENDING}</Row>
          <Row label="Folder">
            <span className="block truncate">{folder || "Top level"}</span>
          </Row>
          <Row label="Used in">{info ? <LinkedNotes notes={info.notes} /> : PENDING}</Row>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
