import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BACKGROUND_CENTER, BACKGROUND_ZOOM } from "../../../entities/settings/model/setting-limits";
import {
  getSettings,
  previewSettings,
  updateSettings,
  useSettings,
} from "../../../entities/settings/model/settings-store";
import { ZoomedImage } from "../../../features/panel-background/ui/panel-background";
import { clamp } from "../../../shared/lib/clamp";
import { Button } from "../../../shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog";
import { SETTING_IDS } from "../model/settings-search";
import { SettingSlider } from "./setting-slider";

const KEY_STEP = 0.05;
const WHEEL_ZOOM_RATE = 0.001;

const percent = (value: number) => `${Math.round(value * 100)}%`;

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-KEY_STEP, 0],
  ArrowRight: [KEY_STEP, 0],
  ArrowUp: [0, -KEY_STEP],
  ArrowDown: [0, KEY_STEP],
};

interface Drag {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
  rangeX: number;
  rangeY: number;
}

function zoomWithWheel(event: WheelEvent) {
  event.preventDefault();
  const zoom = getSettings().backgroundZoom * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
  updateSettings({ backgroundZoom: clamp(zoom, BACKGROUND_ZOOM.min, BACKGROUND_ZOOM.max) });
}

function attachStage(stage: HTMLDivElement) {
  const panel = document.querySelector("main");
  const observer = new ResizeObserver(([entry]) => {
    stage.style.setProperty("--panel-ratio", String(entry.contentRect.width / entry.contentRect.height));
  });
  if (panel) observer.observe(panel);
  stage.addEventListener("wheel", zoomWithWheel, { passive: false });
  return () => {
    observer.disconnect();
    stage.removeEventListener("wheel", zoomWithWheel);
  };
}

function savePosition() {
  const { backgroundPositionX, backgroundPositionY } = getSettings();
  updateSettings({ backgroundPositionX, backgroundPositionY });
}

function PositionPreview({ url, image }: { url: string; image: ImageBitmap }) {
  const { backgroundPositionX: x, backgroundPositionY: y, backgroundZoom: zoom } = useSettings();
  const drag = useRef<Drag | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (!frame.current) return;
    const box = frame.current.getBoundingClientRect();
    const scale = Math.max(box.width / image.width, box.height / image.height) * zoom;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x,
      y,
      rangeX: image.width * scale - box.width,
      rangeY: image.height * scale - box.height,
    };
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    previewSettings({
      backgroundPositionX:
        current.rangeX > 0 ? clamp(current.x - (event.clientX - current.pointerX) / current.rangeX) : current.x,
      backgroundPositionY:
        current.rangeY > 0 ? clamp(current.y - (event.clientY - current.pointerY) / current.rangeY) : current.y,
    });
  };

  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    savePosition();
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_MOVES[event.key];
    if (!step) return;
    event.preventDefault();
    updateSettings({ backgroundPositionX: clamp(x + step[0]), backgroundPositionY: clamp(y + step[1]) });
  };

  return (
    <div
      ref={attachStage}
      role="slider"
      tabIndex={0}
      aria-label="Image position"
      aria-valuetext={`${percent(x)} from the left, ${percent(y)} from the top`}
      className="flex h-80 w-full cursor-grab touch-none items-center select-none justify-center rounded-md bg-foreground/5 outline-none [--panel-ratio:1.6] [container-type:size] focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={nudge}
    >
      <div
        ref={frame}
        className="relative aspect-(--panel-ratio) w-[min(100cqw,100cqh*var(--panel-ratio))] overflow-hidden rounded-md ring-1 ring-foreground/10"
      >
        <ZoomedImage url={url} focus={{ x, y, zoom }} />
      </div>
    </div>
  );
}

export function PositionDialog({ url, image }: { url: string; image: ImageBitmap }) {
  const { backgroundPositionX: x, backgroundPositionY: y, backgroundZoom: zoom } = useSettings();
  const [original, setOriginal] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const centered = x === BACKGROUND_CENTER && y === BACKGROUND_CENTER;

  const cancel = () => {
    if (original)
      updateSettings({
        backgroundPositionX: original.x,
        backgroundPositionY: original.y,
        backgroundZoom: original.zoom,
      });
    setOriginal(null);
  };

  return (
    <>
      <Button id={SETTING_IDS.backgroundPosition} variant="outline" onClick={() => setOriginal({ x, y, zoom })}>
        Adjust position
      </Button>
      <Dialog open={original !== null} onOpenChange={(open) => !open && setOriginal(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Adjust position</DialogTitle>
            <DialogDescription>
              Drag the image to choose what shows behind the main panel. Scroll to zoom.
            </DialogDescription>
          </DialogHeader>
          <PositionPreview url={url} image={image} />
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={centered}
              onClick={() =>
                updateSettings({ backgroundPositionX: BACKGROUND_CENTER, backgroundPositionY: BACKGROUND_CENTER })
              }
            >
              Center
            </Button>
            <SettingSlider
              label="Zoom"
              value={Math.round(zoom * 100)}
              min={BACKGROUND_ZOOM.min * 100}
              max={BACKGROUND_ZOOM.max * 100}
              step={5}
              unit="%"
              labelAfterValue
              thumbAlignment="center"
              onPreview={(value) => previewSettings({ backgroundZoom: value / 100 })}
              onCommit={(value) => updateSettings({ backgroundZoom: value / 100 })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={() => setOriginal(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
