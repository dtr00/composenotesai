import { getCurrentWebview } from "@tauri-apps/api/webview";

export type FileDrop =
  { type: "over"; x: number; y: number } | { type: "drop"; x: number; y: number; paths: string[] } | { type: "leave" };

export function listenForFileDrops(handler: (drop: FileDrop) => void): () => void {
  const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "leave") {
      handler({ type: "leave" });
      return;
    }
    const { x, y } = payload.position.toLogical(window.devicePixelRatio);
    handler(payload.type === "drop" ? { type: "drop", x, y, paths: payload.paths } : { type: "over", x, y });
  });
  return () => void unlisten.then((stop) => stop());
}
