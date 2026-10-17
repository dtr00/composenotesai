export function serveExcalidrawAssetsLocally() {
  Object.assign(window, { EXCALIDRAW_ASSET_PATH: new URL("/excalidraw/", window.location.href).href });
}

export function loadExcalidraw() {
  serveExcalidrawAssetsLocally();
  return import("@excalidraw/excalidraw");
}
