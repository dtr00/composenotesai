import type { ComponentProps, KeyboardEvent } from "react";
import {
  clearTitleDraft,
  setTitleDraft,
  useSavedNoteTitle,
  useTitleDraft,
} from "../../../entities/note/model/note-list-store";
import { commitTitleDraft } from "../model/notes-store";

type NoteTitleInputProps = Omit<ComponentProps<"input">, "value" | "onChange"> & {
  noteId: number;
};

export function NoteTitleInput({ noteId, onBlur, onKeyDown, ...props }: NoteTitleInputProps) {
  const saved = useSavedNoteTitle(noteId) ?? "";
  const draft = useTitleDraft(noteId);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Escape") clearTitleDraft(noteId, e.currentTarget.value);
    if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <input
      aria-label="Note title"
      spellCheck={false}
      {...props}
      value={draft ?? saved}
      onChange={(e) => setTitleDraft(noteId, e.target.value)}
      onBlur={(e) => {
        void commitTitleDraft(noteId);
        onBlur?.(e);
      }}
      onKeyDown={handleKey}
    />
  );
}
