import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { hotkeyLabel, type EditorHotkeyAction } from "../../../entities/settings/model/keybindings";
import {
  BOLD,
  CODE,
  isFormatted,
  isLinked,
  ITALIC,
  STRIKETHROUGH,
  toggleFormat,
  toggleLink,
  UNDERLINE,
  type InlineFormat,
} from "./inline-format";
import { fixed, setBlocks, toggleTasks } from "./line-blocks";

type Command = (view: EditorView) => boolean;

export type InlineAction = Extract<
  EditorHotkeyAction,
  "bold" | "italic" | "underline" | "strikethrough" | "inlineCode" | "link"
>;
export type BlockAction = Extract<
  EditorHotkeyAction,
  "text" | "heading1" | "heading2" | "heading3" | "numberedList" | "bulletedList" | "todoList"
>;

interface EditorFormat {
  label: string;
  hint: string;
  keywords: string[];
  run: Command;
}

export interface InlineEditorFormat extends EditorFormat {
  active: (state: EditorState) => boolean;
}

export interface BlockEditorFormat extends EditorFormat {
  prefix: (index: number) => string;
}

const inline = (action: InlineAction, format: InlineFormat, keywords: string[]): InlineEditorFormat => ({
  label: hotkeyLabel(action),
  hint: format.open,
  keywords,
  run: toggleFormat(format),
  active: (state) => isFormatted(state, format),
});

const block = (
  action: BlockAction,
  hint: string,
  prefix: (index: number) => string,
  keywords: string[],
): BlockEditorFormat => ({ label: hotkeyLabel(action), hint, keywords, prefix, run: setBlocks(prefix) });

export const INLINE_ACTIONS: InlineAction[] = ["bold", "italic", "underline", "strikethrough", "inlineCode", "link"];

export const INLINE_FORMATS: Record<InlineAction, InlineEditorFormat> = {
  bold: inline("bold", BOLD, ["strong"]),
  italic: inline("italic", ITALIC, ["emphasis"]),
  underline: inline("underline", UNDERLINE, ["underscore"]),
  strikethrough: inline("strikethrough", STRIKETHROUGH, ["strike", "crossed out"]),
  inlineCode: inline("inlineCode", CODE, ["code", "monospace"]),
  link: {
    label: hotkeyLabel("link"),
    hint: "[ ]( )",
    keywords: ["url", "hyperlink", "href"],
    run: toggleLink,
    active: isLinked,
  },
};

export const BLOCK_FORMATS: Record<BlockAction, BlockEditorFormat> = {
  text: block("text", "", fixed(""), ["paragraph", "plain"]),
  heading1: block("heading1", "#", fixed("# "), ["h1", "title"]),
  heading2: block("heading2", "##", fixed("## "), ["h2", "title", "subtitle"]),
  heading3: block("heading3", "###", fixed("### "), ["h3", "title"]),
  bulletedList: block("bulletedList", "-", fixed("- "), ["bullet", "unordered", "ul"]),
  numberedList: block("numberedList", "1.", (index) => `${index + 1}. `, ["ordered", "ol", "number"]),
  todoList: block("todoList", "- [ ]", fixed("- [ ] "), ["todo", "task", "checkbox", "checklist"]),
};

const isInlineAction = (action: EditorHotkeyAction): action is InlineAction => action in INLINE_FORMATS;

export function editorCommand(action: EditorHotkeyAction): Command {
  if (action === "toggleTodo") return toggleTasks;
  return isInlineAction(action) ? INLINE_FORMATS[action].run : BLOCK_FORMATS[action].run;
}
