import { Eye, FileText, PencilRuler } from "lucide-react";
import type { RefObject } from "react";
import { isDrawing } from "../../../entities/note/lib/note-format";
import { useNoteFormat, useNoteTitle } from "../../../entities/note/model/note-list-store";
import type { NoteFormat } from "../../../shared/api/notes";
import { HoverCard, HoverCardContent } from "../../../shared/ui/hover-card";
import { useMarkdownView } from "../../../features/markdown-editor/hooks/use-markdown-view";
import { drawingPreview } from "../lib/excalidraw-context";
import { usePreviewBody } from "../model/notes-store";

function MarkdownBody({ body }: { body: string }) {
  return <div ref={useMarkdownView(body)} className="max-h-64 overflow-hidden mask-b-from-80%" />;
}

function PreviewBody({ body, drawing }: { body: string | null; drawing: boolean }) {
  if (body === null) return <p className="text-muted-foreground">Could not load this note.</p>;
  if (drawing) {
    const preview = drawingPreview(body);
    if (!preview) return <p className="text-muted-foreground">Could not read this drawing.</p>;
    return (
      <div className="max-h-64 overflow-hidden">
        <p className="text-muted-foreground">
          {preview.elements === 0 ? "This drawing is empty." : `${preview.elements} drawing elements`}
        </p>
        {preview.text && <p className="mt-2 whitespace-pre-wrap">{preview.text}</p>}
      </div>
    );
  }
  if (body.trim() === "") return <p className="text-muted-foreground">This note is empty.</p>;
  return <MarkdownBody body={body} />;
}

export const NoteIcon = ({ previewable, format }: { previewable: boolean; format: NoteFormat }) =>
  previewable ? <Eye /> : isDrawing(format) ? <PencilRuler /> : <FileText />;

interface NotePreviewProps {
  id: number;
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
}

export function NotePreview({ id, open, anchor }: NotePreviewProps) {
  const title = useNoteTitle(id);
  const drawing = isDrawing(useNoteFormat(id));
  const body = usePreviewBody(id);
  return (
    <HoverCard open={open && body !== undefined}>
      <HoverCardContent anchor={anchor} side="right" align="start" alignOffset={0} sideOffset={8} className="w-80">
        <p className="mb-1.5 truncate font-medium">{title}</p>
        {body !== undefined && <PreviewBody body={body} drawing={drawing} />}
      </HoverCardContent>
    </HoverCard>
  );
}
