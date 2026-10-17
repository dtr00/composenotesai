import { clearPanelBackground, loadPanelBackground, savePanelBackground } from "../../../shared/api/panel-background";
import { markPanelBackground } from "../../../entities/settings/lib/panel-background";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, useStore } from "../../../shared/lib/store";

interface BackgroundState {
  url: string | null;
  image: ImageBitmap | null;
}

const store = createStore<BackgroundState>({ url: null, image: null });

export const usePanelBackground = () => useStore(store);

async function report(task: () => Promise<void>) {
  try {
    await task();
  } catch (e) {
    showError(e, "panel-background");
  }
}

async function show(bytes: ArrayBuffer) {
  const blob = bytes.byteLength > 0 ? new Blob([bytes]) : null;
  const image = blob && (await createImageBitmap(blob));
  const url = blob && URL.createObjectURL(blob);
  const previous = store.get();
  markPanelBackground(url !== null);
  store.set({ url, image });
  if (previous.url) URL.revokeObjectURL(previous.url);
  previous.image?.close();
}

export const startPanelBackground = () => report(async () => show(await loadPanelBackground()));

export const choosePanelBackground = (file: File) =>
  report(async () => {
    const bytes = await file.arrayBuffer();
    await savePanelBackground(bytes);
    await show(bytes);
  });

export const removePanelBackground = () =>
  report(async () => {
    await clearPanelBackground();
    await show(new ArrayBuffer(0));
  });
