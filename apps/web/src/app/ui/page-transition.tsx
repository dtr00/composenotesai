import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { animate, cssColor, prefersReducedMotion, setPixel, threshold } from "@/shared/lib/dither";

const CELL = 8;
const DURATION = 520;

export function PageTransition() {
  const router = useRouter();

  const attach = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      let stop = () => {};
      let frame = context.createImageData(1, 1);
      let order = new Float32Array(0);

      const cover = () => {
        stop();
        const columns = Math.ceil(innerWidth / CELL);
        const rows = Math.ceil(innerHeight / CELL);
        canvas.width = columns;
        canvas.height = rows;
        frame = context.createImageData(columns, rows);
        order = new Float32Array(columns * rows);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < columns; x++) order[y * columns + x] = 0.55 * (y / rows) + 0.45 * threshold(x, y);
        }
        const canvasColor = cssColor(canvas, "--color-canvas");
        for (let i = 0; i < order.length; i++) setPixel(frame.data, i, canvasColor, 255);
        context.putImageData(frame, 0, 0);
        canvas.hidden = false;
      };

      const reveal = () => {
        const canvasColor = cssColor(canvas, "--color-canvas");
        stop = animate(
          DURATION,
          (progress) => {
            const eased = 1 - (1 - progress) ** 3;
            for (let i = 0; i < order.length; i++) setPixel(frame.data, i, canvasColor, order[i] < eased ? 0 : 255);
            context.putImageData(frame, 0, 0);
          },
          () => {
            canvas.hidden = true;
          },
        );
      };

      const leaving = router.subscribe("onBeforeNavigate", (event) => {
        if (event.fromLocation && event.pathChanged && !prefersReducedMotion()) cover();
      });
      const arrived = router.subscribe("onResolved", (event) => {
        if (event.fromLocation && event.pathChanged && !canvas.hidden) reveal();
      });

      return () => {
        stop();
        leaving();
        arrived();
      };
    },
    [router],
  );

  return <canvas ref={attach} hidden className="dither-canvas pointer-events-none fixed inset-0 z-50 size-full" />;
}
