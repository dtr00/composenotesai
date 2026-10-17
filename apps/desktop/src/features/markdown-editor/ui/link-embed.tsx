import { Suspense, use, type MouseEvent } from "react";
import type { LinkPreview } from "../../../shared/api/link-preview";
import { DropdownMenuItem, DropdownMenuSeparator } from "../../../shared/ui/dropdown-menu";
import { hostName } from "../../../shared/lib/web-url";
import { useLayoutObserver } from "../hooks/use-layout-observer";
import { EmbedMenu } from "./embed-menu";
import { RemoteImage } from "./remote-image";

export interface LinkEmbedProps {
  url: string;
  label: string;
  preview: Promise<LinkPreview | null>;
  editable: boolean;
  selected: boolean;
  onLayout: () => void;
  onOpen: (external: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}

type CardProps = Pick<LinkEmbedProps, "url" | "label" | "preview" | "onLayout">;

interface SummaryProps {
  title: string;
  description?: string | null;
  site: string;
}

export function Summary({ title, description, site }: SummaryProps) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5">
      <span className="line-clamp-2 text-sm font-medium break-words">{title}</span>
      {description && <span className="line-clamp-1 text-xs text-muted-foreground">{description}</span>}
      <span className="mt-auto truncate pt-1 text-xs text-muted-foreground">{site}</span>
    </span>
  );
}

function Details({ url, label, preview, onLayout }: CardProps) {
  const details = use(preview);
  return (
    <>
      <Summary
        title={label || details?.title || hostName(url)}
        description={details?.description}
        site={details?.siteName ?? hostName(url)}
      />
      {details?.image && (
        <RemoteImage src={details.image} onLoad={onLayout} className="aspect-[1.91/1] h-full shrink-0 object-cover" />
      )}
    </>
  );
}

export function LinkEmbed({ editable, selected, onOpen, onEdit, onRemove, ...card }: LinkEmbedProps) {
  const layout = useLayoutObserver(card.onLayout);
  const open = (event: MouseEvent) => onOpen(event.ctrlKey || event.metaKey);

  return (
    <div ref={layout} className="flex py-1">
      <div className="group/media relative w-full max-w-xl">
        <button
          type="button"
          data-embed-control
          aria-label={`Open ${card.url}`}
          onClick={open}
          className="flex h-28 w-full cursor-pointer overflow-hidden rounded-lg border bg-card text-left text-card-foreground transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Suspense fallback={<Summary title={card.label || hostName(card.url)} site="Loading preview" />}>
            <Details {...card} />
          </Suspense>
        </button>
        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-primary/25 inset-ring-2 inset-ring-primary"
          />
        )}
        {editable && (
          <EmbedMenu label="Link options">
            {(afterClose) => (
              <>
                <DropdownMenuItem onClick={() => afterClose(onEdit)}>Edit link</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => afterClose(onRemove)}>
                  Remove from note
                </DropdownMenuItem>
              </>
            )}
          </EmbedMenu>
        )}
      </div>
    </div>
  );
}
