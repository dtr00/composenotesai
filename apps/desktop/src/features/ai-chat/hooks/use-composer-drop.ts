import { useCallback, useState } from "react";
import { listenForFileDrops } from "../../../shared/api/file-drop";
import { addEntryDropZone, containsPoint } from "../../../shared/lib/entry-drop";
import { attachEntries, attachPaths, canAttachEntries } from "../model/attachments";

export function useComposerDrop() {
  const [over, setOver] = useState(false);
  const dropZone = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const removeZone = addEntryDropZone({ element, accepts: canAttachEntries, setOver, drop: attachEntries });
    const stopFiles = listenForFileDrops((drop) => {
      const inside = drop.type !== "leave" && containsPoint(element, drop.x, drop.y);
      setOver(inside && drop.type === "over");
      if (inside && drop.type === "drop") void attachPaths(drop.paths);
    });
    return () => {
      removeZone();
      stopFiles();
    };
  }, []);
  return [over, dropZone] as const;
}
