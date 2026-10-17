import { useState } from "react";
import { prefetchBody } from "../model/notes-store";
import { useShiftHeld } from "../model/shift-preview";

export function useNotePreview(id: number) {
  const [hovered, setHovered] = useState(false);
  const shiftHeld = useShiftHeld();
  return {
    previewable: shiftHeld,
    previewing: shiftHeld && hovered,
    hoverProps: {
      onPointerEnter: () => {
        setHovered(true);
        prefetchBody(id);
      },
      onPointerLeave: () => setHovered(false),
    },
  };
}
