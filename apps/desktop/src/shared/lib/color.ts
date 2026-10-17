export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: string) => HEX_COLOR.test(value);

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const toByte = (channel: number) =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0");

export const rgbToHex = ({ r, g, b }: Rgb) => `#${toByte(r)}${toByte(g)}${toByte(b)}`;

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const v = Math.max(r, g, b);
  const range = v - Math.min(r, g, b);
  let h = 0;
  if (range > 0) {
    if (v === r) h = ((g - b) / range) % 6;
    else if (v === g) h = (b - r) / range + 2;
    else h = (r - g) / range + 4;
  }
  return { h: (h * 60 + 360) % 360, s: v === 0 ? 0 : range / v, v };
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: Math.hypot(a, bAxis),
    h: ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360,
  };
}

export const formatOklch = ({ l, c, h }: Oklch) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
