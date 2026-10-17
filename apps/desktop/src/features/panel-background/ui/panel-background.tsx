import { cn } from "cn";
import { useCallback, type CSSProperties } from "react";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { drawDitherArt, type Focus } from "../../../shared/lib/dither-art";
import { usePanelBackground } from "../model/background-store";

const LAYER = "opacity-(--panel-background-opacity) blur-(--panel-background-blur)";
const REDRAW_AFTER_RESIZE_MS = 150;

function DitherCanvas({ image, focus }: { image: ImageBitmap; focus: Focus }) {
  const { x, y, zoom } = focus;
  const followPanel = useCallback(
    (canvas: HTMLCanvasElement) => {
      const panel = canvas.parentElement;
      if (!panel) return;
      let timer = 0;
      let drawnKey: string | null = null;
      const observer = new ResizeObserver(([entry]) => {
        const size = { width: document.documentElement.clientWidth, height: entry.contentRect.height };
        const key = `${size.width}x${size.height}`;
        if (key === drawnKey) return;
        const draw = () => {
          drawnKey = key;
          drawDitherArt(canvas, image, size, { x, y, zoom });
        };
        window.clearTimeout(timer);
        if (drawnKey === null) return draw();
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
        timer = window.setTimeout(draw, REDRAW_AFTER_RESIZE_MS);
      });
      observer.observe(panel);
      return () => {
        observer.disconnect();
        window.clearTimeout(timer);
      };
    },
    [image, x, y, zoom],
  );

  return <canvas ref={followPanel} className={cn("absolute top-0 right-0 [image-rendering:pixelated]", LAYER)} />;
}

export function ZoomedImage({ url, focus }: { url: string; focus: Focus }) {
  const origin = `${focus.x * 100}% ${focus.y * 100}%`;
  return (
    <div
      className="absolute inset-0 bg-cover"
      style={{
        backgroundImage: `url(${url})`,
        backgroundPosition: origin,
        transform: `scale(${focus.zoom})`,
        transformOrigin: origin,
      }}
    />
  );
}

export function PanelBackground() {
  const settings = useSettings();
  const { url, image } = usePanelBackground();
  if (!url || !image) return null;
  const focus = { x: settings.backgroundPositionX, y: settings.backgroundPositionY, zoom: settings.backgroundZoom };
  const layer = {
    "--panel-background-blur": `${settings.backgroundBlur}px`,
    "--panel-background-opacity": String(settings.backgroundOpacity),
  } as CSSProperties;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none" style={layer}>
      {settings.backgroundStyle === "dither" ? (
        <DitherCanvas image={image} focus={focus} />
      ) : (
        <div
          className={cn(
            "absolute inset-y-[calc(var(--panel-background-blur)*-2)] right-[calc(var(--panel-background-blur)*-2)] w-[calc(100vw+var(--panel-background-blur)*4)] overflow-hidden",
            LAYER,
          )}
        >
          <ZoomedImage url={url} focus={focus} />
        </div>
      )}
    </div>
  );
}
