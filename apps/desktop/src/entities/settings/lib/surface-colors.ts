import { clamp } from "../../../shared/lib/clamp";
import { formatOklch, hexToRgb, rgbToHex, rgbToOklch, type Oklch } from "../../../shared/lib/color";
import { withoutTransitions } from "../../../shared/lib/without-transitions";

type Tokens = Record<string, string>;

interface Palette {
  plain: Tokens;
  overImage: Tokens;
}

const DARK_BELOW_LIGHTNESS = 0.6;
const TEXT_CHROMA = 0.01;

const sheet = document.createElement("style");

function surface(hex: string) {
  const base = rgbToOklch(hexToRgb(hex));
  const shift = (lightness: number): Oklch => ({ ...base, l: clamp(base.l + lightness) });
  const text = (lightness: number) => formatOklch({ l: lightness, c: Math.min(base.c, TEXT_CHROMA), h: base.h });
  return { dark: base.l < DARK_BELOW_LIGHTNESS, shade: (lightness: number) => formatOklch(shift(lightness)), text };
}

function panelPalette(hex: string): Palette {
  const { dark, shade, text } = surface(hex);
  const foreground = text(dark ? 0.985 : 0.145);
  const strongForeground = text(dark ? 0.985 : 0.205);
  return {
    plain: {
      "--background": hex,
      "--foreground": foreground,
      "--card": shade(dark ? 0.06 : 0),
      "--card-foreground": foreground,
      "--popover": shade(dark ? 0.06 : 0),
      "--popover-foreground": foreground,
      "--secondary": shade(dark ? 0.124 : -0.03),
      "--secondary-foreground": strongForeground,
      "--muted": shade(dark ? 0.124 : -0.03),
      "--muted-foreground": text(dark ? 0.708 : 0.556),
      "--accent": shade(dark ? 0.124 : -0.03),
      "--accent-foreground": strongForeground,
      "--border": dark ? "oklch(1 0 0 / 10%)" : shade(-0.078),
      "--input": dark ? "oklch(1 0 0 / 15%)" : shade(-0.078),
      "--ring": text(dark ? 0.556 : 0.708),
    },
    overImage: {
      "--muted-foreground": text(dark ? 0.82 : 0.42),
      "--border": dark ? "oklch(1 0 0 / 16%)" : "oklch(0 0 0 / 14%)",
    },
  };
}

function sidebarPalette(hex: string): Palette {
  const { dark, shade, text } = surface(hex);
  return {
    plain: {
      "--sidebar": hex,
      "--sidebar-foreground": text(dark ? 0.985 : 0.145),
      "--sidebar-muted-foreground": text(dark ? 0.708 : 0.556),
      "--sidebar-accent": shade(dark ? 0.064 : -0.015),
      "--sidebar-accent-foreground": text(dark ? 0.985 : 0.205),
      "--sidebar-border": dark ? "oklch(1 0 0 / 10%)" : shade(-0.063),
      "--sidebar-ring": text(dark ? 0.556 : 0.708),
    },
    overImage: {
      "--sidebar-border": dark ? "oklch(1 0 0 / 16%)" : "oklch(0 0 0 / 14%)",
    },
  };
}

const declarations = (tokens: Tokens) =>
  Object.entries(tokens)
    .map(([token, value]) => `${token}: ${value};`)
    .join(" ");

export function applySurfaceColors({ sidebar, panel }: { sidebar: string | null; panel: string | null }) {
  const palettes: Palette[] = [];
  if (panel) palettes.push(panelPalette(panel));
  if (sidebar) palettes.push(sidebarPalette(sidebar));
  const plain = palettes.reduce<Tokens>((all, palette) => ({ ...all, ...palette.plain }), {});
  const overImage = palettes.reduce<Tokens>((all, palette) => ({ ...all, ...palette.overImage }), {});
  withoutTransitions(() => {
    sheet.textContent = `html:root { ${declarations(plain)} } html:root.has-panel-background { ${declarations(overImage)} }`;
    if (!sheet.isConnected) document.head.append(sheet);
  });
}

let probe: CanvasRenderingContext2D | null = null;

export function currentColor(token: string): string {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return "#000000";
  probe.fillStyle = "#000000";
  probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return rgbToHex({ r: r / 255, g: g / 255, b: b / 255 });
}
