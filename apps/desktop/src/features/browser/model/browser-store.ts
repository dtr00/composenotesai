import { forgetPageTitle, setPageTitle } from "../../../entities/web-page/model/page-titles";
import {
  closeAllBrowserViews,
  closeBrowserView,
  hideBrowserView,
  onNewTabRequest,
  onPageLoad,
  onPageTitle,
  reloadBrowserView,
  setBrowserViewBounds,
  showBrowserView,
  stopBrowserView,
  type BrowserBounds,
  type PageLoad,
  type PageTitle,
} from "../../../shared/api/browser";
import { matchWeb } from "../../../shared/config/routes";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, useSelector } from "../../../shared/lib/store";
import { isWebUrl } from "../../../shared/lib/web-url";

type Phase = "requested" | "opening" | "loading" | "idle";

interface Page {
  url: string;
  phase: Phase;
  untitled: boolean;
}

interface BrowserHandlers {
  visit: (tab: number, url: string, replace: boolean) => void;
  openTab: (url: string) => void;
}

const pages = createStore<ReadonlyMap<number, Page>>(new Map());
let handlers: BrowserHandlers | undefined;
let queue = Promise.resolve();

export const usePageLoading = (tab: number): boolean =>
  useSelector(pages, (all) => (all.get(tab)?.phase ?? "idle") !== "idle");

function enqueue(command: () => Promise<void>) {
  queue = queue.then(command).catch((error: unknown) => showError(error));
}

function setPage(tab: number, page: Page | null) {
  const next = new Map(pages.get());
  if (page) next.set(tab, page);
  else next.delete(tab);
  pages.set(next);
}

function arrive(tab: number, page: Page, url: string, replace: boolean) {
  const web = isWebUrl(url);
  setPage(tab, { url: web ? url : page.url, phase: "idle", untitled: false });
  if (web) handlers?.visit(tab, url, replace);
}

function loaded({ tab, url, loading }: PageLoad) {
  const page = pages.get().get(tab);
  if (!page) return;
  if (loading) {
    setPage(tab, { ...page, phase: page.phase === "requested" ? "opening" : "loading" });
    return;
  }
  if (page.phase === "requested") return;
  if (page.untitled) forgetPageTitle(tab);
  arrive(tab, page, url, page.phase === "opening");
}

// WebKit blanks the title as each page commits, just before reporting the new one, so a blank
// title only replaces the old one if the page finishes loading without a title of its own.
function retitled({ tab, url, title }: PageTitle) {
  const page = pages.get().get(tab);
  if (!page) return;
  if (title) setPageTitle(tab, title);
  if (page.phase === "idle" && page.url !== url) arrive(tab, page, url, false);
  else if (page.untitled === Boolean(title)) setPage(tab, { ...page, untitled: !title });
}

export function startBrowser(browserHandlers: BrowserHandlers) {
  handlers = browserHandlers;
  enqueue(closeAllBrowserViews);
  void onPageLoad(loaded);
  void onPageTitle(retitled);
  void onNewTabRequest(browserHandlers.openTab);
}

export function visitBrowser(tab: number, url: string, bounds: BrowserBounds): boolean {
  const page = pages.get().get(tab);
  if (page?.url === url) return false;
  setPage(tab, { url, phase: "requested", untitled: false });
  enqueue(() =>
    showBrowserView(tab, url, bounds).catch((error: unknown) => {
      setPage(tab, page ?? null);
      throw error;
    }),
  );
  return true;
}

export const revealBrowser = (tab: number, bounds: BrowserBounds) => enqueue(() => showBrowserView(tab, null, bounds));

export function showBrowser(tab: number, url: string, bounds: BrowserBounds) {
  if (!visitBrowser(tab, url, bounds)) revealBrowser(tab, bounds);
}

export const placeBrowser = (tab: number, bounds: BrowserBounds) => enqueue(() => setBrowserViewBounds(tab, bounds));

export const hideBrowser = (tab: number) => enqueue(() => hideBrowserView(tab));

export const reloadBrowser = (tab: number) => enqueue(() => reloadBrowserView(tab));

export const stopBrowser = (tab: number) => enqueue(() => stopBrowserView(tab));

interface BrowserTab {
  id: number;
  entries: readonly string[];
}

export function keepBrowsers(tabs: readonly BrowserTab[]) {
  const kept = new Set(
    tabs.filter((tab) => tab.entries.some((entry) => matchWeb(entry) !== null)).map((tab) => tab.id),
  );
  for (const tab of pages.get().keys()) {
    if (kept.has(tab)) continue;
    setPage(tab, null);
    forgetPageTitle(tab);
    enqueue(() => closeBrowserView(tab));
  }
}
