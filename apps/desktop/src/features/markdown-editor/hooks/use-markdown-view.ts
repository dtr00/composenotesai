import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useCallback } from "react";
import { liveMarkdown } from "../lib/live-preview";

export function useMarkdownView(doc: string) {
  return useCallback(
    (parent: HTMLDivElement | null) => {
      if (!parent) return;
      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc,
          extensions: [liveMarkdown, EditorState.readOnly.of(true), EditorView.editable.of(false)],
        }),
      });
      return () => view.destroy();
    },
    [doc],
  );
}
