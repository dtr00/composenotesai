import { useState } from "react";
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
import { Checkbox } from "../../../shared/ui/checkbox";
import { closeDeleteRequest, confirmDeleteRequest, useDeleteRequest } from "../model/delete-store";

export function DeleteDialog() {
  const { target, open } = useDeleteRequest();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeDeleteRequest();
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setDontAskAgain(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{target?.heading}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block text-pretty">{target?.description}</span>
            {target?.usage && <span className="mt-2 block text-pretty text-foreground">{target.usage}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {target?.canSkipConfirm && (
            <label className="mr-auto flex w-fit cursor-pointer items-center gap-2 text-xs select-none">
              <Checkbox checked={dontAskAgain} onCheckedChange={setDontAskAgain} />
              Don&apos;t show this again
            </label>
          )}
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => confirmDeleteRequest(dontAskAgain)}>
            Move to trash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
