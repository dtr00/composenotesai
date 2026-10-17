import { Suspense, use } from "react";
import type { LinkPreview } from "../../../shared/api/link-preview";
import { hostName } from "../../../shared/lib/web-url";
import { RemoteImage } from "./remote-image";

interface LinkPreviewCardProps {
  url: string;
  preview: Promise<LinkPreview | null>;
  onLayout: () => void;
}

function Details({ url, preview, onLayout }: LinkPreviewCardProps) {
  const details = use(preview);
  return (
    <>
      {details?.image && (
        <RemoteImage
          src={details.image}
          onLoad={onLayout}
          className="aspect-[1.91/1] w-full rounded-md bg-muted object-cover"
        />
      )}
      <div className="flex flex-col gap-1 p-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {details?.icon && (
            <RemoteImage src={details.icon} onLoad={onLayout} className="size-3.5 shrink-0 rounded-sm" />
          )}
          <span className="truncate">{details?.siteName ?? hostName(url)}</span>
        </div>
        <p className="line-clamp-2 font-medium break-words">{details?.title ?? url}</p>
        {details?.description && <p className="line-clamp-3 text-muted-foreground">{details.description}</p>}
      </div>
    </>
  );
}

export function LinkPreviewCard(props: LinkPreviewCardProps) {
  return (
    <div className="flex w-80 flex-col text-xs/relaxed">
      <Suspense fallback={<p className="truncate p-1.5 text-muted-foreground">Loading {hostName(props.url)}</p>}>
        <Details {...props} />
      </Suspense>
    </div>
  );
}
