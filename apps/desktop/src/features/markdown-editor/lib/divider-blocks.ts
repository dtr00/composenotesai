import { EditorView } from "@codemirror/view";
import { insideCode } from "./markdown-syntax";

function typeDivider(view: EditorView, from: number, to: number, text: string) {
  const { state } = view;
  const line = state.doc.lineAt(from);
  if (text !== "-" || from !== to || from !== line.to || line.text !== "--" || insideCode(state, from)) return false;
  const previous = line.number > 1 ? state.doc.line(line.number - 1).text : "";
  const insert = `${previous.trim() === "" ? "" : "\n"}---\n`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
    selection: { anchor: line.from + insert.length },
    userEvent: "input.type",
  });
  return true;
}

export const dividerBlocks = EditorView.inputHandler.of(typeDivider);
