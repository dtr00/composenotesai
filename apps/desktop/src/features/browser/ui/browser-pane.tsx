import type { RefObject } from "react";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { useBrowserView } from "../hooks/use-browser-view";

interface BrowserAddressProps {
  url: string;
  visit: RefObject<((url: string) => void) | null>;
}

function BrowserAddress({ url, visit }: BrowserAddressProps) {
  useMountEffect(() => visit.current?.(url));
  return null;
}

export function BrowserPane({ tab, url }: { tab: number; url: string }) {
  const { area, visit } = useBrowserView(tab, url);
  return (
    <div ref={area} className="min-h-0 flex-1 bg-background">
      <BrowserAddress key={url} url={url} visit={visit} />
    </div>
  );
}
