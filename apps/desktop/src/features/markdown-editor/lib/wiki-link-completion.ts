import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { getEntries } from "../../../entities/note/model/note-list-store";
import { notesIn } from "../../../entities/note/model/note-tree";
import { insideCode } from "./markdown-syntax";

const OPEN_LINK = /\[\[[^[\]\n|]*$/;
const QUERY = /^[^[\]\n|]*$/;
const CLOSE = "]]";

export function wikiLinkSource(context: CompletionContext): CompletionResult | null {
  const typed = context.matchBefore(OPEN_LINK);
  if (!typed || insideCode(context.state, context.pos)) return null;
  const closed = context.state.sliceDoc(context.pos, context.pos + CLOSE.length) === CLOSE;
  const options = notesIn(getEntries()).map((note) => ({
    label: note.title,
    detail: "Note",
    apply: closed ? note.title : `${note.title}${CLOSE}`,
  }));
  return { from: typed.from + 2, options, validFor: QUERY };
}
