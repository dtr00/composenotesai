import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { pressedEditorAction } from "../../../entities/settings/model/keybindings";
import { editorCommand } from "./editor-formats";

export const editorHotkeys = Prec.high(
  keymap.of([
    {
      any: (view, event) => {
        const action = pressedEditorAction(event);
        return action !== null && editorCommand(action)(view);
      },
    },
  ]),
);
