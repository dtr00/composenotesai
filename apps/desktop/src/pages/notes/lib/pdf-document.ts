import type { PDFPageProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { readMedia } from "../../../shared/api/notes";

const PRELOAD_MARGIN = "100% 0px";
const MAX_CANVAS_PIXELS = 4096 * 4096;
const PAGE_CLASS = "h-auto w-full rounded-sm bg-white outline outline-foreground/10";

async function loadPdf(id: number) {
  const [bytes, pdfjs] = await Promise.all([readMedia(id), import("pdfjs-dist/legacy/build/pdf.mjs")]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs.getDocument({ data: new Uint8Array(bytes) });
}

function renderPage(page: PDFPageProxy, width: number) {
  const unscaled = page.getViewport({ scale: 1 });
  const fitted = (width * devicePixelRatio) / unscaled.width;
  const capped = Math.sqrt(MAX_CANVAS_PIXELS / (unscaled.width * unscaled.height));
  const viewport = page.getViewport({ scale: Math.min(fitted, capped) });
  const buffer = document.createElement("canvas");
  buffer.width = Math.floor(viewport.width);
  buffer.height = Math.floor(viewport.height);
  return { buffer, task: page.render({ canvas: buffer, viewport }) };
}

function showBuffer(canvas: HTMLCanvasElement, buffer: HTMLCanvasElement) {
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  canvas.getContext("2d")?.drawImage(buffer, 0, 0);
}

function pageCanvas(page: PDFPageProxy) {
  const { width, height } = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.className = PAGE_CLASS;
  canvas.style.aspectRatio = `${width} / ${height}`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Page ${page.pageNumber}`);
  return canvas;
}

const isCancellation = (error: unknown) => error instanceof Error && error.name === "RenderingCancelledException";

export function mountPdf(container: HTMLElement, id: number, onError: () => void) {
  let cancelled = false;
  const loading = loadPdf(id);
  const pages = new Map<HTMLCanvasElement, PDFPageProxy>();
  const drawnWidths = new Map<HTMLCanvasElement, number>();
  const rendering = new Map<HTMLCanvasElement, RenderTask>();
  const visible = new Set<HTMLCanvasElement>();

  const stopRendering = (canvas: HTMLCanvasElement) => {
    rendering.get(canvas)?.cancel();
    rendering.delete(canvas);
  };
  const draw = (canvas: HTMLCanvasElement) => {
    const page = pages.get(canvas);
    if (!page || drawnWidths.get(canvas) === canvas.clientWidth) return;
    stopRendering(canvas);
    drawnWidths.set(canvas, canvas.clientWidth);
    const { buffer, task } = renderPage(page, canvas.clientWidth);
    rendering.set(canvas, task);
    task.promise
      .then(
        () => showBuffer(canvas, buffer),
        (error: unknown) => {
          if (!cancelled && !isCancellation(error)) onError();
        },
      )
      .finally(() => {
        if (rendering.get(canvas) === task) rendering.delete(canvas);
      });
  };
  const release = (canvas: HTMLCanvasElement) => {
    stopRendering(canvas);
    drawnWidths.delete(canvas);
    canvas.width = 0;
    canvas.height = 0;
  };

  const visibility = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!(target instanceof HTMLCanvasElement)) continue;
        if (isIntersecting) {
          visible.add(target);
          draw(target);
        } else {
          visible.delete(target);
          release(target);
        }
      }
    },
    { root: container.parentElement, rootMargin: PRELOAD_MARGIN },
  );
  const resizing = new ResizeObserver((entries) => {
    for (const { target } of entries) if (target instanceof HTMLCanvasElement && visible.has(target)) draw(target);
  });

  loading
    .then((task) => task.promise)
    .then(async (pdf) => {
      for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const canvas = pageCanvas(page);
        pages.set(canvas, page);
        container.append(canvas);
        visibility.observe(canvas);
        resizing.observe(canvas);
      }
    })
    .catch(() => {
      if (!cancelled) onError();
    });

  return () => {
    cancelled = true;
    visibility.disconnect();
    resizing.disconnect();
    for (const task of rendering.values()) task.cancel();
    container.replaceChildren();
    loading.then(
      (task) => void task.destroy(),
      () => {},
    );
  };
}
