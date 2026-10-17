import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { EditorView, showTooltip, type Rect, type Tooltip, type TooltipView } from "@codemirror/view";
import { createElement } from "react";
import { FormatToolbar } from "../ui/format-toolbar";
import { POPOVER_SURFACE } from "./popover-surface";
import { renderWidget, unmountWidget } from "./widget-roots";

const TOOLBAR_CLASS = "cm-format-toolbar";
const TOOLBAR_GAP_PX = 6;

const setFocused = StateEffect.define<boolean>();

const focusedField = StateField.define<boolean>({
  create: () => false,
  update: (focused, tr) =>
    tr.effects.reduce((value, effect) => (effect.is(setFocused) ? effect.value : value), focused),
});

function scrollingAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

function anchorCoords(view: EditorView, dom: HTMLElement, pos: number): Rect | null {
  const start = view.coordsAtPos(pos, 1);
  const scroller = scrollingAncestor(view.dom);
  if (!start || !scroller) return start;
  const top = scroller.getBoundingClientRect().top + dom.offsetHeight + TOOLBAR_GAP_PX;
  if (start.top >= top) return start;
  const end = view.coordsAtPos(view.state.selection.main.to, -1);
  if (!end || end.bottom <= top + view.defaultLineHeight) return start;
  return { left: start.left, right: start.right, top, bottom: top + view.defaultLineHeight };
}

function createToolbar(view: EditorView): TooltipView {
  const dom = document.createElement("div");
  dom.className = TOOLBAR_CLASS;
  const render = (state: EditorState) => renderWidget(dom, createElement(FormatToolbar, { view, state }));
  render(view.state);
  return {
    dom,
    getCoords: (pos) => anchorCoords(view, dom, pos) ?? { left: 0, right: 0, top: -1e4, bottom: -1e4 },
    update: (update) => render(update.state),
    destroy: () => unmountWidget(dom),
  };
}

function toolbarFor(state: EditorState): Tooltip | null {
  const range = state.selection.main;
  const usable = !state.readOnly && state.field(focusedField) && state.selection.ranges.length === 1;
  return usable && /\S/.test(state.sliceDoc(range.from, range.to))
    ? { pos: range.from, end: range.to, above: true, create: createToolbar }
    : null;
}

const toolbarField = StateField.define<Tooltip | null>({
  create: toolbarFor,
  update(toolbar, tr) {
    const refocused = tr.effects.some((effect) => effect.is(setFocused));
    return tr.docChanged || tr.selection || refocused ? toolbarFor(tr.state) : toolbar;
  },
  provide: (field) => showTooltip.from(field),
});

const toolbarTheme = EditorView.theme({
  [`.cm-tooltip.${TOOLBAR_CLASS}`]: { ...POPOVER_SURFACE, padding: "0.125rem" },
  [`.cm-tooltip.${TOOLBAR_CLASS}.cm-tooltip-above`]: { marginTop: `${-TOOLBAR_GAP_PX}px` },
  [`.cm-tooltip.${TOOLBAR_CLASS}.cm-tooltip-below`]: { marginTop: `${TOOLBAR_GAP_PX}px` },
});

export const formatToolbar = [
  focusedField,
  EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing)),
  toolbarField,
  toolbarTheme,
];
