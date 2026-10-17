import { clamp } from "./clamp";

const BLOCK = 2;
const LEVELS = 4;
const CACHED_SIZES = 4;
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export interface ArtSize {
  width: number;
  height: number;
}

export interface Focus {
  x: number;
  y: number;
  zoom: number;
}

function coverCrop(image: ImageBitmap, { width, height }: ArtSize, focus: Focus) {
  const scale = Math.max(width / image.width, height / image.height) * focus.zoom;
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  return {
    x: (image.width - cropWidth) * focus.x,
    y: (image.height - cropHeight) * focus.y,
    width: cropWidth,
    height: cropHeight,
  };
}

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function ditheredLuminance(value: number, threshold: number): number {
  const steps = LEVELS - 1;
  const level = Math.round(value * steps + threshold);
  return clamp(level, 0, steps) / steps;
}

const bayerThreshold = (row: number, column: number) => (BAYER_4X4[(row % 4) * 4 + (column % 4)] + 0.5) / 16;

function blockGrid(size: ArtSize) {
  return { columns: Math.max(1, Math.ceil(size.width / BLOCK)), rows: Math.max(1, Math.ceil(size.height / BLOCK)) };
}

function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const context = canvas.getContext("2d", options);
  if (!context) throw new Error("Could not draw the dithered background.");
  return context;
}

function fitToBlocks(canvas: HTMLCanvasElement, size: ArtSize) {
  const grid = blockGrid(size);
  if (canvas.width !== grid.columns) canvas.width = grid.columns;
  if (canvas.height !== grid.rows) canvas.height = grid.rows;
  canvas.style.width = `${grid.columns * BLOCK}px`;
  canvas.style.height = `${grid.rows * BLOCK}px`;
  return grid;
}

const drawn = new WeakMap<ImageBitmap, Map<string, ImageData>>();

function remember(image: ImageBitmap, key: string, pixels: ImageData) {
  const cache = drawn.get(image) ?? new Map<string, ImageData>();
  cache.set(key, pixels);
  if (cache.size > CACHED_SIZES) cache.delete(cache.keys().next().value ?? key);
  drawn.set(image, cache);
}

export function drawDitherArt(canvas: HTMLCanvasElement, image: ImageBitmap, size: ArtSize, focus: Focus) {
  const { columns, rows } = fitToBlocks(canvas, size);
  const art = context2d(canvas, { willReadFrequently: true });
  const key = `${columns}x${rows}@${focus.x},${focus.y},${focus.zoom}`;
  const cached = drawn.get(image)?.get(key);
  if (cached) {
    art.putImageData(cached, 0, 0);
    return;
  }
  art.imageSmoothingQuality = "high";
  const crop = coverCrop(image, { width: columns * BLOCK, height: rows * BLOCK }, focus);
  art.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, columns, rows);

  const pixels = art.getImageData(0, 0, columns, rows);
  const data = pixels.data;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const threshold = bayerThreshold(row, column) - 0.5;
      const i = (row * columns + column) * 4;
      const value = luminance(data[i], data[i + 1], data[i + 2]);
      const brightest = Math.max(data[i], data[i + 1], data[i + 2]);
      const scale = value > 0 ? Math.min(ditheredLuminance(value, threshold) / value, 255 / brightest) : 0;
      data[i] = data[i] * scale;
      data[i + 1] = data[i + 1] * scale;
      data[i + 2] = data[i + 2] * scale;
    }
  }
  art.putImageData(pixels, 0, 0);
  remember(image, key, pixels);
}
