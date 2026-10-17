import { animate, cssColor, hash, setPixel, threshold } from "@/shared/lib/dither";

const CELL = 2;
const DURATION = 560;
const MAX_SHIFT = 5;

function coverage(text: HTMLElement, columns: number, rows: number): Float32Array {
  const style = getComputedStyle(text);
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cells = new Float32Array(columns * rows);
  if (!context) return cells;
  context.scale(1 / CELL, 1 / CELL);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.letterSpacing = style.letterSpacing;
  const metrics = context.measureText(text.textContent ?? "");
  const ascent = metrics.fontBoundingBoxAscent;
  const height = ascent + metrics.fontBoundingBoxDescent;
  context.fillText(text.textContent ?? "", 0, (text.offsetHeight - height) / 2 + ascent);
  const data = context.getImageData(0, 0, columns, rows).data;
  for (let i = 0; i < cells.length; i++) cells[i] = data[i * 4 + 3] / 255;
  return cells;
}

export function playGlitch(text: HTMLElement, canvas: HTMLCanvasElement, done: () => void) {
  const context = canvas.getContext("2d");
  if (!context) return done();

  const columns = Math.ceil(text.offsetWidth / CELL);
  const rows = Math.ceil(text.offsetHeight / CELL);
  canvas.width = columns;
  canvas.height = rows;
  canvas.style.top = `${text.offsetTop}px`;
  canvas.style.left = `${text.offsetLeft}px`;
  canvas.style.width = `${columns * CELL}px`;
  canvas.style.height = `${rows * CELL}px`;
  const cells = coverage(text, columns, rows);
  const near = Uint8Array.from(cells, (value, i) => {
    const x = i % columns;
    return value > 0 || (x > 0 && cells[i - 1] > 0) || (x < columns - 1 && cells[i + 1] > 0) ? 1 : 0;
  });
  const frame = context.createImageData(columns, rows);
  const ink = cssColor(canvas, "--color-text");
  const accent = cssColor(canvas, "--color-accent");

  animate(
    DURATION,
    (progress) => {
      const intensity = Math.sin(Math.PI * progress);
      const seed = Math.floor(progress * 14);
      frame.data.fill(0);
      for (let y = 0; y < rows; y++) {
        const shift = hash(y, seed) > 0.6 ? Math.round((hash(seed, y) - 0.5) * 2 * MAX_SHIFT * intensity) : 0;
        for (let x = 0; x < columns; x++) {
          const source = x - shift;
          if (source < 0 || source >= columns) continue;
          const index = y * columns + source;
          if (!near[index]) continue;
          const density = cells[index] * (1 - 0.4 * intensity) + hash(x, y + seed) * 0.35 * intensity;
          if (density <= threshold(x, y)) continue;
          const glint = intensity > 0.4 && hash(x + seed, y) > 0.94;
          setPixel(frame.data, y * columns + x, glint ? accent : ink, 255);
        }
      }
      context.putImageData(frame, 0, 0);
    },
    done,
  );
}
