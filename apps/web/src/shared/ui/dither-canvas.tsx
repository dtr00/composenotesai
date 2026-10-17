import { useCallback } from "react";
import { cssColor, prefersReducedMotion, setPixel, threshold, type Shader } from "@/shared/lib/dither";

const CELL = 3;

const STILL_FRAME_SECONDS = 2;

function startDither(canvas: HTMLCanvasElement, shader: Shader) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ink = cssColor(canvas, "--ink");
  let frame = context.createImageData(1, 1);

  const draw = (seconds: number) => {
    const { width, height } = canvas;
    const density = shader(width, height, seconds);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        setPixel(frame.data, y * width + x, ink, density(x, y) > threshold(x, y) ? 255 : 0);
      }
    }
    context.putImageData(frame, 0, 0);
  };

  const still = prefersReducedMotion();
  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(1, Math.round(canvas.clientWidth / CELL));
    const height = Math.max(1, Math.round(canvas.clientHeight / CELL));
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    frame = context.createImageData(width, height);
    draw(still ? STILL_FRAME_SECONDS : performance.now() / 1000);
  });
  resizeObserver.observe(canvas);
  if (still) return () => resizeObserver.disconnect();

  let visible = false;
  let frameId = 0;
  const loop = (time: number) => {
    draw(time / 1000);
    frameId = visible ? requestAnimationFrame(loop) : 0;
  };
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frameId) frameId = requestAnimationFrame(loop);
  });
  visibility.observe(canvas);

  return () => {
    resizeObserver.disconnect();
    visibility.disconnect();
    cancelAnimationFrame(frameId);
  };
}

type DitherCanvasProps = {
  shader: Shader;
  className?: string;
};

export function DitherCanvas({ shader, className = "" }: DitherCanvasProps) {
  const attach = useCallback(
    (canvas: HTMLCanvasElement | null) => (canvas ? startDither(canvas, shader) : undefined),
    [shader],
  );
  return <canvas ref={attach} className={`dither-canvas ${className}`} aria-hidden="true" />;
}
