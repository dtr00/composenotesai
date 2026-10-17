import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useCallback, useRef, type KeyboardEvent } from "react";
import { markdownEditor } from "../../../features/markdown-editor/lib/markdown-editor";
import { openWebTab } from "../../../features/tabs/model/tabs-store";
import { copiedFiles } from "../../../shared/api/notes";
import { aiWriting, isAiEdit } from "../lib/ai-writing";
import { reportUnreadableMedia, saveMedia } from "../model/note-media";
import { editNote, latestBody, openNoteByTitle, saveDrafts, type OpenNote } from "../model/notes-store";

const EDITOR_THEME = EditorView.theme({
  ".cm-content": { paddingBottom: "40vh" },
});

export function useMarkdownEditor(note: OpenNote, labelledBy: string) {
  const titleRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const titleCursor = useRef<number | null>(null);

  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const view = viewRef.current;
    if (!view || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key !== "ArrowDown" && event.key !== "Enter") return;
    const title = event.currentTarget;
    if (event.key === "ArrowDown" && title.selectionStart !== title.selectionEnd) return;
    titleCursor.current = title.selectionStart;
    event.preventDefault();
    view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
    view.focus();
  };

  const editorRef = useCallback(
    (parent: HTMLDivElement | null) => {
      if (!parent) return;
      titleCursor.current = null;
      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc: latestBody(note.id),
          extensions: [
            keymap.of([
              {
                key: "ArrowUp",
                run: (view) => {
                  const { main, ranges } = view.state.selection;
                  const title = titleRef.current;
                  if (!title || !main.empty || ranges.length !== 1) return false;
                  if (view.moveToLineBoundary(main, false).head !== 0) return false;
                  const position = Math.min(titleCursor.current ?? title.value.length, title.value.length);
                  title.focus();
                  title.setSelectionRange(position, position);
                  return true;
                },
              },
            ]),
            markdownEditor({
              media: { save: saveMedia, copiedFiles, onUnreadable: reportUnreadableMedia },
              openPageLink: openNoteByTitle,
              openWebLink: openWebTab,
            }),
            EDITOR_THEME,
            aiWriting(note.id),
            EditorView.contentAttributes.of({ "aria-labelledby": labelledBy }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged && !isAiEdit(update)) editNote(note.id, update.state.doc.toString());
            }),
            EditorView.domEventHandlers({
              blur: () => {
                void saveDrafts();
              },
            }),
          ],
        }),
      });
      viewRef.current = view;
      view.focus();
      return () => {
        viewRef.current = null;
        view.destroy();
      };
    },
    [note, labelledBy],
  );

  return { editorRef, titleRef, onTitleKeyDown };
}
