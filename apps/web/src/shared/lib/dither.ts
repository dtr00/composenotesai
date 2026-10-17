export type Shader = (width: number, height: number, seconds: number) => (x: number, y: number) => number;

const BAYER_SIZE = 8;

export function hash(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function bayerMatrix(size: number): Float32Array {
  let matrix = [0];
  for (let n = 1; n < size; n *= 2) {
    const next: number[] = new Array(4 * n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 4 * matrix[y * n + x];
        next[y * 2 * n + x] = v;
        next[y * 2 * n + x + n] = v + 2;
        next[(y + n) * 2 * n + x] = v + 3;
        next[(y + n) * 2 * n + x + n] = v + 1;
      }
    }
    matrix = next;
  }
  const cells = size * size;
  return Float32Array.from(matrix, (v) => (v + 0.5) / cells);
}

const BAYER = bayerMatrix(BAYER_SIZE);

export function threshold(x: number, y: number): number {
  return BAYER[(y % BAYER_SIZE) * BAYER_SIZE + (x % BAYER_SIZE)];
}

export type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function cssColor(element: Element, property: string): Rgb {
  return hexToRgb(getComputedStyle(element).getPropertyValue(property).trim());
}

export function setPixel(data: Uint8ClampedArray, index: number, [r, g, b]: Rgb, alpha: number) {
  const i = index * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = alpha;
}

export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function animate(duration: number, frame: (progress: number) => void, done?: () => void): () => void {
  const start = performance.now();
  let id = requestAnimationFrame(function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    frame(progress);
    if (progress < 1) id = requestAnimationFrame(tick);
    else done?.();
  });
  return () => cancelAnimationFrame(id);
}
