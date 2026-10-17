import { EditorSelection } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

function collapseSelection(view: EditorView) {
  const { main, ranges } = view.state.selection;
  if (main.empty && ranges.length === 1) return false;
  view.dispatch({ selection: EditorSelection.cursor(main.head), userEvent: "select" });
  return true;
}

export const selectionClearing = [
  keymap.of([{ key: "Escape", run: collapseSelection }]),
  EditorView.domEventHandlers({
    mousedown(event, view) {
      const { main } = view.state.selection;
      if (event.button !== 0 || event.detail > 1 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
        return false;
      if (main.empty) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null || pos < main.from || pos > main.to) return false;
      view.dispatch({ selection: EditorSelection.cursor(pos), userEvent: "select.pointer" });
      return false;
    },
  }),
];
