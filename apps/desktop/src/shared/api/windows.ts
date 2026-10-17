import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, type CloseRequestedEvent } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export const openWindow = (path: string) => invoke<void>("open_window", { path });

export const isMainWindow = appWindow.label === "main";

export const printPage = () => invoke<void>("print_page");

export const minimizeWindow = () => appWindow.minimize();
export const toggleMaximizeWindow = () => appWindow.toggleMaximize();
export const closeWindow = () => appWindow.close();

export const onWindowCloseRequested = (handler: (event: CloseRequestedEvent) => Promise<void>) =>
  appWindow.onCloseRequested(handler);
