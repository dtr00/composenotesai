import { loadNote } from "../../../shared/api/notes";
import { reportAction } from "../../../shared/lib/error-toast";
import { saveDrafts } from "./notes-store";

const DOWNLOAD_URL_LIFETIME_MS = 30_000;

const fileName = (title: string) =>
  Array.from(title, (char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char)).join("");

async function exportDrawing(id: number) {
  await saveDrafts();
  const note = await loadNote(id);
  const url = URL.createObjectURL(new Blob([note.body], { type: "application/vnd.excalidraw+json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName(note.title)}.excalidraw`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

export const exportExcalidrawNote = (id: number) => void reportAction(exportDrawing(id));
