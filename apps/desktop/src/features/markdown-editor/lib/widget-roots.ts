import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Transaction } from "@codemirror/state";
import { EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IconProvider } from "../../../shared/ui/icon-provider";

const roots = new WeakMap<HTMLElement, Root>();

export function renderWidget(dom: HTMLElement, element: ReactElement) {
  let root = roots.get(dom);
  if (!root) {
    root = createRoot(dom);
    roots.set(dom, root);
  }
  root.render(createElement(IconProvider, null, element));
}

export function unmountWidget(dom: HTMLElement) {
  const root = roots.get(dom);
  roots.delete(dom);
  queueMicrotask(() => root?.unmount());
}

export const isEditable = (state: EditorState) => state.facet(EditorView.editable) && !state.readOnly;

export abstract class ReactWidget extends WidgetType {
  protected abstract readonly tag: "div" | "span";
  protected abstract readonly className: string;
  protected abstract element(view: EditorView, dom: HTMLElement): ReactElement;

  toDOM(view: EditorView) {
    const dom = document.createElement(this.tag);
    dom.className = this.className;
    dom.contentEditable = "false";
    renderWidget(dom, this.element(view, dom));
    return dom;
  }

  updateDOM(dom: HTMLElement, view: EditorView) {
    if (!roots.has(dom) || dom.tagName.toLowerCase() !== this.tag) return false;
    renderWidget(dom, this.element(view, dom));
    return true;
  }

  destroy(dom: HTMLElement) {
    unmountWidget(dom);
  }
}

interface DecorationFieldOptions {
  followSelection?: boolean;
  rebuildWhen?: (tr: Transaction) => boolean;
}

export function decorationField(
  build: (state: EditorState) => DecorationSet,
  { followSelection = false, rebuildWhen = () => false }: DecorationFieldOptions = {},
) {
  return StateField.define<DecorationSet>({
    create: build,
    update(decorations, tr) {
      const reparsed = syntaxTree(tr.state) !== syntaxTree(tr.startState);
      const rebuild = tr.docChanged || reparsed || (followSelection && tr.selection) || rebuildWhen(tr);
      return rebuild ? build(tr.state) : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
