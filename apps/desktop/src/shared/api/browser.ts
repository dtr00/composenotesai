import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Hotkey } from "../lib/hotkeys";

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLoad {
  tab: number;
  url: string;
  loading: boolean;
}

export interface PageTitle {
  tab: number;
  url: string;
  title: string;
}

interface NewTabRequest {
  url: string;
}

export interface BrowserHotkey extends Hotkey {
  action: string;
}

interface PressedHotkey {
  action: string;
}

const appWebview = getCurrentWebviewWindow();

export const showBrowserView = (tab: number, url: string | null, bounds: BrowserBounds) =>
  invoke<void>("browser_show", { tab, url, bounds });
export const setBrowserViewBounds = (tab: number, bounds: BrowserBounds) =>
  invoke<void>("browser_set_bounds", { tab, bounds });
export const hideBrowserView = (tab: number) => invoke<void>("browser_hide", { tab });
export const reloadBrowserView = (tab: number) => invoke<void>("browser_reload", { tab });
export const stopBrowserView = (tab: number) => invoke<void>("browser_stop", { tab });
export const closeBrowserView = (tab: number) => invoke<void>("browser_close", { tab });
export const closeAllBrowserViews = () => invoke<void>("browser_close_all");
export const clearBrowserCache = () => invoke<void>("browser_clear_cache");
export const setBrowserHotkeys = (bindings: BrowserHotkey[]) => invoke<void>("browser_set_hotkeys", { bindings });

export const onPageLoad = (handler: (load: PageLoad) => void) =>
  appWebview.listen<PageLoad>("browser-load", (event) => handler(event.payload));
export const onPageTitle = (handler: (title: PageTitle) => void) =>
  appWebview.listen<PageTitle>("browser-title", (event) => handler(event.payload));
export const onNewTabRequest = (handler: (url: string) => void) =>
  appWebview.listen<NewTabRequest>("browser-new-tab", (event) => handler(event.payload.url));
export const onBrowserHotkey = (handler: (action: string) => void) =>
  appWebview.listen<PressedHotkey>("browser-hotkey", (event) => handler(event.payload.action));
