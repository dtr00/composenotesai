import { MEDIA_LABELS } from "../../../entities/note/lib/media-labels";
import { useMedia, useMediaMissing } from "../../../entities/note/model/note-list-store";
import { EntryIcon } from "../../../entities/note/ui/entry-icon";
import type { MediaSummary, MediaType } from "../../../shared/api/notes";
import { mediaFormatLabel } from "../../../shared/config/media-types";
import { entryPath } from "../../../shared/config/routes";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { navigate } from "../../../shared/lib/hash-router";
import { useLayoutObserver } from "../hooks/use-layout-observer";
import { MediaMenu, MissingMedia } from "./media-embed";

export interface DocumentEmbedProps {
  mediaId: number | null;
  alt: string;
  block: boolean;
  editable: boolean;
  selected: boolean;
  onLayout: () => void;
  onRemove: () => void;
}

interface FileSummaryProps {
  mediaType: MediaType;
  media: MediaSummary | undefined;
  alt: string;
}

export function FileSummary({ mediaType, media, alt }: FileSummaryProps) {
  const details = media ? [mediaFormatLabel(media.mime), formatBytes(media.bytes)].filter(Boolean).join(" · ") : "";
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <EntryIcon type={mediaType} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{media?.name ?? (alt || MEDIA_LABELS[mediaType])}</span>
        {details && <span className="truncate text-xs text-muted-foreground">{details}</span>}
      </span>
    </>
  );
}

export function DocumentEmbed({ mediaId, alt, block, editable, selected, onLayout, onRemove }: DocumentEmbedProps) {
  const layout = useLayoutObserver(onLayout);
  const media = useMedia(mediaId);
  const missing = useMediaMissing(mediaId) || mediaId === null;
  const name = media?.name ?? alt;

  return (
    <div ref={layout} className={block ? "flex py-1" : "inline-flex align-bottom"}>
      <div className="group/media relative w-full max-w-sm">
        {missing ? (
          <MissingMedia mediaType="document" alt={alt} />
        ) : (
          <button
            type="button"
            data-embed-control
            aria-label={`Open ${name}`}
            onClick={() => mediaId !== null && navigate(entryPath({ kind: "media", id: mediaId }))}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card py-2.5 pr-12 pl-3 text-left text-card-foreground transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <FileSummary mediaType="document" media={media} alt={alt} />
          </button>
        )}
        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-primary/25 inset-ring-2 inset-ring-primary"
          />
        )}
        {editable && (
          <MediaMenu mediaType="document" mediaId={mediaId} onRemove={onRemove} className="top-1/2 -translate-y-1/2" />
        )}
      </div>
    </div>
  );
}
