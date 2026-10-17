import { useHashPath } from "../../../shared/lib/hash-router";
import { noteIdIn } from "../lib/note-route";

export const useCurrentNoteId = (): number | null => noteIdIn(useHashPath());
