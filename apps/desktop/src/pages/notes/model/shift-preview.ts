import { createStore, updateStore, useSelector } from "../../../shared/lib/store";
import { isEditable } from "../../../shared/lib/editable";

const TYPING_PAUSE_MS = 1000;

interface ShiftPreview {
  held: boolean;
  inTree: boolean;
  usedInTree: boolean;
}

const preview = createStore<ShiftPreview>({ held: false, inTree: false, usedInTree: false });

export const useShiftHeld = () => useSelector(preview, (state) => state.held);

export const useTreeTooltipsHidden = () => useSelector(preview, (state) => state.held || state.usedInTree);

export const enterTree = () => updateStore(preview, { inTree: true, usedInTree: preview.get().held });

export const leaveTree = () => updateStore(preview, { inTree: false, usedInTree: false });

function setHeld(held: boolean) {
  const state = preview.get();
  if (state.held === held) return;
  updateStore(preview, { held, usedInTree: state.usedInTree || (held && state.inTree) });
}

export function trackShiftHeld() {
  let pressed = false;
  let typed = false;
  let lastTypedAt = -Infinity;
  const release = () => {
    pressed = false;
    typed = false;
    setHeld(false);
  };
  const typingRecently = (now: number) => isEditable(document.activeElement) && now - lastTypedAt < TYPING_PAUSE_MS;

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Shift") {
      lastTypedAt = event.timeStamp;
      typed = pressed;
      if (typed) setHeld(false);
    } else if (!pressed) {
      pressed = true;
      typed = false;
      if (!typingRecently(event.timeStamp)) setHeld(true);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "Shift") release();
  });
  window.addEventListener("pointermove", (event) => {
    if (!event.shiftKey) release();
    else if (!typed) {
      pressed = true;
      setHeld(true);
    }
  });
  window.addEventListener("blur", release);
}
