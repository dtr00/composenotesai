import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { aiActivityOf, subscribeToAiActivity } from "../../../entities/note/model/ai-activity";
import { watchNoteBody } from "../model/notes-store";

const aiEdit = Annotation.define<boolean>();

const LOCKED: Extension = [EditorView.editable.of(false), EditorState.readOnly.of(true)];

const lockFor = (noteId: number): Extension => (aiActivityOf(noteId) === "writing" ? LOCKED : []);

function showAiBody(view: EditorView, body: string) {
  const current = view.state.doc.toString();
  if (current === body) return;
  let from = 0;
  const shortest = Math.min(current.length, body.length);
  while (from < shortest && current[from] === body[from]) from++;
  let end = 0;
  while (end < shortest - from && current[current.length - 1 - end] === body[body.length - 1 - end]) end++;
  const insert = body.slice(from, body.length - end);
  view.dispatch({
    changes: { from, to: current.length - end, insert },
    annotations: aiEdit.of(true),
    effects: EditorView.scrollIntoView(from + insert.length, { y: "nearest" }),
  });
}

export const isAiEdit = (update: ViewUpdate) =>
  update.transactions.some((transaction) => transaction.annotation(aiEdit));

export function aiWriting(noteId: number): Extension {
  const lock = new Compartment();
  const follower = ViewPlugin.define((view) => {
    const stopWatching = watchNoteBody(noteId, (body) => showAiBody(view, body));
    const stopLocking = subscribeToAiActivity(() => view.dispatch({ effects: lock.reconfigure(lockFor(noteId)) }));
    return {
      destroy() {
        stopWatching();
        stopLocking();
      },
    };
  });
  return [lock.of(lockFor(noteId)), follower];
}
