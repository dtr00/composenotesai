import type { NoteFormat } from "../../../shared/api/notes";

export const isDrawing = (format: NoteFormat | undefined) => format === "excalidraw";

export const drawingTag = (format: NoteFormat | undefined) => (isDrawing(format) ? ", Excalidraw drawing" : "");
