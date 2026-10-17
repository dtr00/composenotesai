import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { insideCode } from "./markdown-syntax";

export const SLASH_HINT = "Type / for commands";

class SlashHintWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const hint = document.createElement("span");
    hint.className = "cm-md-slash-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = SLASH_HINT;
    return hint;
  }

  ignoreEvent() {
    return false;
  }
}

const hint = Decoration.widget({ widget: new SlashHintWidget(), side: 1 });

function hintAt(view: EditorView): DecorationSet {
  const { state } = view;
  const { main } = state.selection;
  if (!view.hasFocus || !main.empty || state.doc.length === 0 || !state.facet(EditorView.editable))
    return Decoration.none;
  const line = state.doc.lineAt(main.head);
  if (line.length > 0 || insideCode(state, line.from)) return Decoration.none;
  return Decoration.set(hint.range(line.from));
}

export const slashHint = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = hintAt(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) this.decorations = hintAt(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.theme({
    ".cm-md-slash-hint": {
      display: "inline-block",
      width: "0",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      color: "var(--muted-foreground)",
    },
  }),
];
