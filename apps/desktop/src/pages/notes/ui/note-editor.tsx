import { useId } from "react";
import { useAiActivity } from "../../../entities/note/model/ai-activity";
import { stopRun } from "../../../features/ai-chat/model/chat-store";
import { Button } from "../../../shared/ui/button";
import { DitherGlyph } from "../../../shared/ui/dither-glyph";
import { useMarkdownEditor } from "../hooks/use-markdown-editor";
import { DROP_PANE_ATTRIBUTE } from "../../../features/markdown-editor/lib/media-drop";
import type { OpenNote } from "../model/notes-store";
import { NoteTitleInput } from "./note-title-input";

function AiWritingBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border bg-background/80 px-2.5 py-1.5 text-xs backdrop-blur"
    >
      <DitherGlyph label="AI is writing" />
      <span className="flex-1 text-muted-foreground">
        Compose AI is writing this note. You can edit it when it's done.
      </span>
      <Button variant="ghost" size="sm" onClick={stopRun}>
        Stop
      </Button>
    </div>
  );
}

export function NoteEditor({ note }: { note: OpenNote }) {
  const titleId = useId();
  const { editorRef, titleRef, onTitleKeyDown } = useMarkdownEditor(note, titleId);
  const writing = useAiActivity(note.id) === "writing";

  return (
    <div {...{ [DROP_PANE_ATTRIBUTE]: "" }} className="-mx-8 min-h-0 flex-1 overflow-y-auto px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        {writing && <AiWritingBanner />}
        <NoteTitleInput
          ref={titleRef}
          noteId={note.id}
          id={titleId}
          onKeyDown={onTitleKeyDown}
          className="mb-4 bg-transparent py-0.5 text-[22px] font-semibold outline-none"
        />
        <div ref={editorRef} className="text-base" />
      </div>
    </div>
  );
}
