import { counted } from "../../../shared/lib/plural";
import type { ChangeCounts } from "../lib/note-changes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../shared/ui/alert-dialog";

interface RevertDialogProps {
  open: boolean;
  changes: ChangeCounts;
  onOpenChange: (open: boolean) => void;
  onRevert: () => void;
}

export function RevertDialog({ open, changes, onOpenChange, onRevert }: RevertDialogProps) {
  const edited = changes.notes - changes.created;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert to before this message?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block text-pretty">
              {edited > 0 &&
                `The AI's changes to ${counted(edited, "note")} from here on are undone, including any edits you made since. `}
              {changes.created > 0 &&
                `${counted(changes.created, "note")} it created ${changes.created === 1 ? "moves" : "move"} to the trash.`}
            </span>
            <span className="mt-2 block text-pretty">
              This message and the replies after it are removed, and your message goes back in the box so you can try
              again.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onRevert}>
            Revert
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
