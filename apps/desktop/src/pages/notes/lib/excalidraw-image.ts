import type { ToolImage } from "../../../features/ai-chat/model/conversation";
import { loadExcalidraw } from "./excalidraw-module";

const MAX_EDGE = 1536;
const MAX_PIXELS = 1_600_000;
const SMALL_EDGE = 768;
const MAX_UPSCALE = 2;
const MAX_BYTES = 1_500_000;
const SHRINK = 0.7;
const ATTEMPTS = 4;
const PADDING = 24;
const JPEG_QUALITY = 0.85;
const CACHED_DRAWINGS = 4;
const TYPES = ["image/png", "image/jpeg"] as const;

export interface DrawingImage {
  image: ToolImage;
  scale: number;
}

export function exportScale(width: number, height: number, shrink = 1): number {
  const longest = Math.max(width, height, 1);
  const fit = Math.min(MAX_EDGE / longest, Math.sqrt(MAX_PIXELS / Math.max(width * height, 1)));
  const enlarge = Math.min(MAX_UPSCALE, Math.max(1, SMALL_EDGE / longest));
  return Math.min(fit, enlarge) * shrink;
}

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(",") + 1));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the drawing image."));
    reader.readAsDataURL(blob);
  });

async function render(body: string): Promise<DrawingImage | null> {
  const { exportToBlob, loadFromBlob } = await loadExcalidraw();
  const scene = await loadFromBlob(new Blob([body]), null, null);
  const elements = scene.elements.filter((element) => !element.isDeleted);
  if (elements.length === 0) return null;
  const background = scene.appState.viewBackgroundColor;
  const appState = {
    ...scene.appState,
    exportBackground: true,
    exportWithDarkMode: false,
    exportEmbedScene: false,
    viewBackgroundColor: background && background !== "transparent" ? background : "#ffffff",
  };
  let shrink = 1;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let size = { width: 0, height: 0, scale: 1 };
    const getDimensions = (width: number, height: number) => {
      const scale = exportScale(width, height, shrink);
      size = { width: Math.round(width * scale), height: Math.round(height * scale), scale };
      return size;
    };
    for (const mimeType of TYPES) {
      const quality = mimeType === "image/jpeg" ? JPEG_QUALITY : undefined;
      const options = { elements, appState, files: scene.files, exportPadding: PADDING, getDimensions };
      const blob = await exportToBlob({ ...options, mimeType, quality });
      if (blob.size > MAX_BYTES) continue;
      const { width, height, scale } = size;
      return { image: { mimeType, data: await base64(blob), width, height }, scale };
    }
    shrink *= SHRINK;
  }
  throw new Error("This drawing is too large to turn into an image.");
}

const rendered = new Map<string, Promise<DrawingImage | null>>();

export function drawingImage(body: string): Promise<DrawingImage | null> {
  const cached = rendered.get(body);
  if (cached) {
    rendered.delete(body);
    rendered.set(body, cached);
    return cached;
  }
  const image = render(body);
  rendered.set(body, image);
  image.catch(() => rendered.delete(body));
  for (const oldest of rendered.keys()) {
    if (rendered.size <= CACHED_DRAWINGS) break;
    rendered.delete(oldest);
  }
  return image;
}
