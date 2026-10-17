import { cn } from "cn";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp } from "../lib/clamp";
import { hexToRgb, hsvToRgb, isHexColor, rgbToHex, rgbToHsv, type Hsv } from "../lib/color";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { firstValue, Slider } from "./slider";

export interface ColorPreset {
  label: string;
  value: string;
}

interface ColorPickerProps {
  value: string;
  onValueChange: (hex: string) => void;
  onValueCommit: (hex: string) => void;
  presets?: ColorPreset[];
  "aria-label"?: string;
}

const KEY_STEP = 0.01;
const AREA_RESOLUTION = { width: 256, height: 128 };
const SHIFT_KEY_STEP = 0.1;

const toHsv = (hex: string) => rgbToHsv(hexToRgb(hex));
const toHex = (hsv: Hsv) => rgbToHex(hsvToRgb(hsv));
const percent = (n: number) => `${Math.round(n * 100)}%`;

const KEY_MOVES: Record<string, (hsv: Hsv, step: number) => Hsv> = {
  ArrowLeft: (hsv, step) => ({ ...hsv, s: clamp(hsv.s - step) }),
  ArrowRight: (hsv, step) => ({ ...hsv, s: clamp(hsv.s + step) }),
  ArrowDown: (hsv, step) => ({ ...hsv, v: clamp(hsv.v - step) }),
  ArrowUp: (hsv, step) => ({ ...hsv, v: clamp(hsv.v + step) }),
};

function paintSaturation(canvas: HTMLCanvasElement, hue: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width, height } = canvas;
  const whiteFade = context.createLinearGradient(0, 0, width, 0);
  whiteFade.addColorStop(0, "#fff");
  whiteFade.addColorStop(1, "#fff0");
  const blackFade = context.createLinearGradient(0, height, 0, 0);
  blackFade.addColorStop(0, "#000");
  blackFade.addColorStop(1, "#0000");
  for (const fill of [`hsl(${hue} 100% 50%)`, whiteFade, blackFade]) {
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
  }
}

function SaturationArea({
  hsv,
  onChange,
  onCommit,
}: {
  hsv: Hsv;
  onChange: (hsv: Hsv) => void;
  onCommit: (hsv: Hsv) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const paint = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas) paintSaturation(canvas, hsv.h);
    },
    [hsv.h],
  );

  const pick = (event: PointerEvent<HTMLDivElement>): Hsv => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      h: hsv.h,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    };
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move(hsv, event.shiftKey ? SHIFT_KEY_STEP : KEY_STEP);
    onChange(next);
    onCommit(next);
  };

  return (
    <div
      ref={area}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${percent(hsv.s)}, brightness ${percent(hsv.v)}`}
      className="relative h-32 cursor-crosshair touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        area.current?.focus();
        onChange(pick(event));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onChange(pick(event));
      }}
      onPointerUp={(event) => onCommit(pick(event))}
      onKeyDown={handleKeyDown}
    >
      <canvas ref={paint} {...AREA_RESOLUTION} className="absolute inset-0 size-full rounded-md" />
      <div
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/30"
        style={{ left: percent(hsv.s), top: percent(1 - hsv.v) }}
      />
    </div>
  );
}

function HexInput({ hex, onCommit }: { hex: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? hex;

  return (
    <Input
      aria-label="Hex color"
      value={text}
      spellCheck={false}
      aria-invalid={!isHexColor(text)}
      className="uppercase tabular-nums"
      onChange={(event) => {
        const next = event.target.value.trim();
        setDraft(next);
        if (isHexColor(next)) onCommit(next.toLowerCase());
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function ColorPicker({ value, onValueChange, onValueCommit, presets = [], ...props }: ColorPickerProps) {
  const [hsv, setHsv] = useState(() => toHsv(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setHsv(toHsv(value));
  }
  const hex = toHex(hsv);

  const change = (next: Hsv) => {
    setHsv(next);
    onValueChange(toHex(next));
  };
  const commit = (next: Hsv) => {
    setHsv(next);
    onValueCommit(toHex(next));
  };
  const commitHex = (next: string) => commit(toHsv(next));

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="uppercase tabular-nums" {...props} />}>
        <span className="size-3.5 rounded-sm ring-1 ring-foreground/15" style={{ backgroundColor: hex }} />
        {hex}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 gap-3">
        <SaturationArea hsv={hsv} onChange={change} onCommit={commit} />
        <Slider
          aria-label="Hue"
          min={0}
          max={360}
          value={hsv.h}
          onValueChange={(h) => change({ ...hsv, h: firstValue(h) })}
          onValueCommitted={(h) => commit({ ...hsv, h: firstValue(h) })}
          className="[&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-track]]:h-3 [&_[data-slot=slider-track]]:rounded-full [&_[data-slot=slider-track]]:bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
        />
        <HexInput hex={hex} onCommit={commitHex} />
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={preset.label}
                aria-pressed={preset.value === hex}
                className={cn(
                  "size-5 rounded-full ring-1 ring-foreground/15 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-popover",
                )}
                style={{ backgroundColor: preset.value }}
                onClick={() => commitHex(preset.value)}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
