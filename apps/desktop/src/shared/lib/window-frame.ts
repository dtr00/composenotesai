import { getCurrentWindow } from "@tauri-apps/api/window";
import { createStore, useStore } from "./store";

const RESIZE_SETTLE_MS = 100;

const appWindow = getCurrentWindow();
const maximized = createStore(false);

export function trackWindowMaximized() {
  let timer: number | undefined;
  const sync = async () => maximized.set(await appWindow.isMaximized());
  void sync();
  void appWindow.onResized(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void sync(), RESIZE_SETTLE_MS);
  });
}

export const useWindowMaximized = () => useStore(maximized);
