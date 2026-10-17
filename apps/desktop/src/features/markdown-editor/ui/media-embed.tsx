import { cn } from "cn";
import { FileX, ImageOff, type LucideIcon } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { useMediaMissing } from "../../../entities/note/model/note-list-store";
import { entryPath } from "../../../shared/config/routes";
import { clamp } from "../../../shared/lib/clamp";
import { navigate } from "../../../shared/lib/hash-router";
import { trackPointerDrag } from "../../../shared/lib/pointer-drag";
import { Button } from "../../../shared/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "../../../shared/ui/dropdown-menu";
import { MEDIA_LABELS } from "../../../entities/note/lib/media-labels";
import type { MediaType } from "../../../shared/api/notes";
import { useLayoutObserver } from "../hooks/use-layout-observer";
import { EmbedMenu } from "./embed-menu";

const MIN_WIDTH_PX = 64;

const MEDIA_ERRORS: Record<number, string> = {
  1: "loading was interrupted",
  2: "of a network error",
  3: "it couldn't be decoded",
  4: "its format isn't supported",
};

interface MediaProblemProps {
  message: string;
  icon?: LucideIcon;
  onRetry?: () => void;
}

function MediaProblem({ message, icon: Icon = ImageOff, onRetry }: MediaProblemProps) {
  return (
    <span className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{message}</span>
      {onRetry && (
        <Button data-embed-control variant="ghost" size="xs" className="ml-auto" onClick={onRetry}>
          Retry
        </Button>
      )}
    </span>
  );
}

export function MissingMedia({ mediaType, alt }: { mediaType: MediaType; alt: string }) {
  return (
    <MediaProblem
      icon={mediaType === "document" ? FileX : ImageOff}
      message={`${MEDIA_LABELS[mediaType]} not found${alt && `: ${alt}`}`}
    />
  );
}

type Side = "left" | "right";

export interface MediaEmbedProps {
  src: string;
  mediaType: MediaType;
  mediaId: number | null;
  alt: string;
  width: number | null;
  block: boolean;
  editable: boolean;
  selected: boolean;
  onLayout: () => void;
  onResize: (width: number | null) => void;
  onRemove: () => void;
}

function ResizeHandle({ side, onPointerDown }: { side: Side; onPointerDown: (event: PointerEvent) => void }) {
  return (
    <span
      data-embed-control
      aria-hidden
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-y-0 flex w-4 cursor-ew-resize items-center justify-center opacity-0 transition-opacity group-hover/media:opacity-100 group-data-resizing/media:opacity-100",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <span className="h-12 max-h-1/2 w-1.5 rounded-full bg-foreground/60 ring-1 ring-background" />
    </span>
  );
}

interface MediaMenuProps {
  mediaType: MediaType;
  mediaId: number | null;
  onOriginalSize?: () => void;
  onRemove: () => void;
  className?: string;
}

export function MediaMenu({ mediaType, mediaId, onOriginalSize, onRemove, className }: MediaMenuProps) {
  return (
    <EmbedMenu label={`${MEDIA_LABELS[mediaType]} options`} className={className}>
      {(afterClose) => (
        <>
          {mediaId !== null && (
            <DropdownMenuItem onClick={() => afterClose(() => navigate(entryPath({ kind: "media", id: mediaId })))}>
              Open {mediaType}
            </DropdownMenuItem>
          )}
          {onOriginalSize && (
            <DropdownMenuItem onClick={() => afterClose(onOriginalSize)}>Original size</DropdownMenuItem>
          )}
          {(mediaId !== null || onOriginalSize) && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onClick={() => afterClose(onRemove)}>
            Remove from note
          </DropdownMenuItem>
        </>
      )}
    </EmbedMenu>
  );
}

export function MediaEmbed({
  src,
  mediaType,
  mediaId,
  alt,
  width,
  block,
  editable,
  selected,
  onLayout,
  onResize,
  onRemove,
}: MediaEmbedProps) {
  const frame = useRef<HTMLDivElement>(null);
  const layout = useLayoutObserver(onLayout);
  const [draft, setDraft] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const missing = useMediaMissing(mediaId);
  const failed = failure !== null || missing;

  const retry = () => {
    setFailure(null);
    setAttempt(attempt + 1);
  };
  const shown = draft ?? width;

  const startResize = (side: Side, event: PointerEvent) => {
    const element = frame.current;
    if (!element) return;
    event.preventDefault();
    const start = element.getBoundingClientRect().width;
    const max = element.parentElement?.clientWidth ?? start;
    const direction = side === "right" ? 2 : -2;
    let next = start;
    trackPointerDrag(event, {
      cursor: "ew-resize",
      onStart: () => setDraft(start),
      onMove: (move) => {
        next = Math.round(clamp(start + (move.clientX - event.clientX) * direction, MIN_WIDTH_PX, max));
        setDraft(next);
      },
      onEnd: (dropped) => {
        if (dropped) onResize(next);
        setDraft(null);
      },
    });
  };

  return (
    <div ref={layout} className={block ? "flex justify-center py-1" : "inline-flex align-bottom"}>
      <div
        ref={frame}
        data-resizing={draft !== null || undefined}
        className="group/media relative max-w-full"
        style={{ width: shown ?? undefined }}
      >
        {missing ? (
          <MissingMedia mediaType={mediaType} alt={alt} />
        ) : failure !== null ? (
          <MediaProblem message={`Couldn't load this ${mediaType} because ${failure}.`} onRetry={retry} />
        ) : mediaType === "video" ? (
          <video
            key={attempt}
            data-embed-control
            src={src}
            aria-label={alt}
            controls
            playsInline
            preload="metadata"
            onError={(event) => setFailure(MEDIA_ERRORS[event.currentTarget.error?.code ?? 0] ?? "of an unknown error")}
            className={cn("block h-auto max-w-full rounded-md bg-black", shown !== null && "w-full")}
          />
        ) : (
          <img
            key={attempt}
            src={src}
            alt={alt}
            draggable={false}
            onError={() => setFailure("it couldn't be read")}
            className={cn("block h-auto max-w-full rounded-md", shown !== null && "w-full")}
          />
        )}
        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md bg-primary/25 inset-ring-2 inset-ring-primary"
          />
        )}
        {editable && !failed && (
          <>
            <ResizeHandle side="left" onPointerDown={(event) => startResize("left", event)} />
            <ResizeHandle side="right" onPointerDown={(event) => startResize("right", event)} />
          </>
        )}
        {editable && (
          <MediaMenu
            mediaType={mediaType}
            mediaId={mediaId}
            onOriginalSize={width === null ? undefined : () => onResize(null)}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );
}
