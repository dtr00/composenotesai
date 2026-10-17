import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openUrl } from "../../../shared/api/links";
import { showError } from "../../../shared/lib/error-toast";
import { navigate } from "../../../shared/lib/hash-router";
import { isWebUrl } from "../../../shared/lib/web-url";
import { pageLinkOpener } from "./page-links";
import { selectionTouches } from "./markdown-syntax";

export const LINK_CLASS = "cm-md-link";
export const MISSING_LINK_CLASS = "cm-md-link-missing";
const APP_LINK = "#/";
const EMAIL = /^[^\s@:/]+@[^\s@]+$/;
export type OpenWebLink = (url: string) => void;

export const webLinkOpener = Facet.define<OpenWebLink, OpenWebLink | null>({
  combine: (openers) => openers[0] ?? null,
});

export function linkHref(url: string) {
  const target = url.trim().replace(/^<(.*)>$/, "$1");
  if (/^www\./i.test(target)) return `https://${target}`;
  return EMAIL.test(target) ? `mailto:${target}` : target;
}

export function openLink(view: EditorView, href: string, external: boolean) {
  const openWeb = external ? null : view.state.facet(webLinkOpener);
  if (href.startsWith(APP_LINK)) navigate(href.slice(1));
  else if (openWeb && isWebUrl(href)) openWeb(href);
  else openUrl(href).catch((e: unknown) => showError(e));
}

function editingLineAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  return view.hasFocus && selectionTouches(view.state, line.from, line.to);
}

export const linkClicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || !(event.target instanceof Element)) return false;
    const link = event.target.closest<HTMLElement>(`.${LINK_CLASS}`);
    const { href, wiki } = link?.dataset ?? {};
    const openPage = view.state.facet(pageLinkOpener);
    if (!link || (!href && !(wiki && openPage))) return false;
    const external = event.ctrlKey || event.metaKey;
    if (!external && editingLineAt(view, view.posAtDOM(link))) return false;
    event.preventDefault();
    if (wiki && openPage) openPage(wiki);
    else if (href) openLink(view, href, external);
    return true;
  },
});
