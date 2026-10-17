import { lazy, Suspense } from "react";
import { serveExcalidrawAssetsLocally } from "../lib/excalidraw-module";
import type { OpenNote } from "../model/notes-store";

const DrawingCanvas = lazy(async () => {
  serveExcalidrawAssetsLocally();
  const { ExcalidrawCanvas } = await import("./excalidraw-canvas");
  return { default: ExcalidrawCanvas };
});

export function ExcalidrawEditor({ note }: { note: OpenNote }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="m-auto text-sm text-muted-foreground">
          Opening drawing…
        </p>
      }
    >
      <DrawingCanvas note={note} />
    </Suspense>
  );
}
