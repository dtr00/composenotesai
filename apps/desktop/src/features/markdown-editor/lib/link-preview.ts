import { EditorView, hoverTooltip, type Tooltip } from "@codemirror/view";
import { createElement } from "react";
import { LinkPreviewCard } from "../ui/link-preview-card";
import { isWebUrl } from "../../../shared/lib/web-url";
import { LINK_CLASS } from "./link-clicks";
import { previewFor } from "./page-previews";
import { POPOVER_SURFACE } from "./popover-surface";
import { renderWidget, unmountWidget } from "./widget-roots";

const PREVIEW_CLASS = "cm-link-preview";
const HOVER_MS = 500;

function linkAt(view: EditorView, pos: number, side: -1 | 1): Tooltip | null {
  const { node } = view.domAtPos(pos, side);
  const link = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(`.${LINK_CLASS}`);
  const url = link?.dataset.href;
  if (!link || !url || !isWebUrl(url)) return null;
  const from = view.posAtDOM(link);
  return {
    pos: from,
    end: from + (link.textContent?.length ?? 0),
    above: false,
    create() {
      const dom = document.createElement("div");
      dom.className = PREVIEW_CLASS;
      renderWidget(
        dom,
        createElement(LinkPreviewCard, { url, preview: previewFor(url), onLayout: () => view.requestMeasure() }),
      );
      return { dom, destroy: () => unmountWidget(dom) };
    },
  };
}

const previewTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-hover": { backgroundColor: "transparent", border: "none", marginTop: "4px" },
  [`.${PREVIEW_CLASS}`]: POPOVER_SURFACE,
});

export const linkPreviews = [hoverTooltip(linkAt, { hoverTime: HOVER_MS }), previewTheme];
