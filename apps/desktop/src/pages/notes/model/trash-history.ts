import { restoreFromTrash } from "../../../entities/note/model/trash-store";
import { REDO_HOTKEYS, UNDO_HOTKEY } from "../../../entities/settings/model/reserved-hotkeys";
import type { EntryRef } from "../../../shared/api/notes";
import { isEditable } from "../../../shared/lib/editable";
import { hotkeyFromEvent, sameHotkey } from "../../../shared/lib/hotkeys";
import { reportAction } from "../../../shared/lib/error-toast";
import { trashEntriesAndClose } from "./notes-store";

const HISTORY_LIMIT = 50;

const undoStack: number[][] = [];
const redoStack: EntryRef[][] = [];

function remember(trashIds: number[]) {
  if (trashIds.length === 0) return;
  undoStack.push(trashIds);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
}

export async function moveToTrash(entries: EntryRef[]) {
  remember(await trashEntriesAndClose(entries));
  redoStack.length = 0;
}

async function undoTrash() {
  const trashIds = undoStack.pop();
  if (!trashIds) return;
  const restored = await reportAction(restoreFromTrash(trashIds));
  if (restored && restored.length > 0) redoStack.push(restored);
}

async function redoTrash() {
  const entries = redoStack.pop();
  if (entries) remember(await trashEntriesAndClose(entries));
}

export function listenForTrashHistory() {
  window.addEventListener("keydown", (event) => {
    if (isEditable(event.target)) return;
    const pressed = hotkeyFromEvent(event);
    if (!pressed) return;
    if (sameHotkey(pressed, UNDO_HOTKEY)) {
      event.preventDefault();
      void undoTrash();
    } else if (REDO_HOTKEYS.some((redo) => sameHotkey(pressed, redo))) {
      event.preventDefault();
      void redoTrash();
    }
  });
}
