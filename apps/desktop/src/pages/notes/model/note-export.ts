import { createElement } from "react";
import { loadNote } from "../../../shared/api/notes";
import { loadCodeParsers } from "../../../features/markdown-editor/lib/code-languages";
import { parseNoteMarkdown } from "../../../features/markdown-editor/lib/note-markdown";
import { printDocument } from "../../../features/markdown-editor/lib/print-page";
import { loadLinkPreviews } from "../../../features/markdown-editor/lib/print-previews";
import { PrintDocument } from "../../../features/markdown-editor/ui/print-document";
import { reportAction } from "../../../shared/lib/error-toast";
import { saveDrafts } from "./notes-store";

async function exportPdf(id: number) {
  await saveDrafts();
  const { title, body } = await loadNote(id);
  const tree = parseNoteMarkdown(body);
  const [parsers, previews] = await Promise.all([loadCodeParsers(tree, body), loadLinkPreviews(tree, body)]);
  await printDocument(title, createElement(PrintDocument, { title, body, tree, parsers, previews }));
}

export const exportNoteAsPdf = (id: number) => void reportAction(exportPdf(id));
