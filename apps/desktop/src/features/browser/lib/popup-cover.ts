const POPUP_SLOTS = [
  "alert-dialog",
  "combobox",
  "context-menu",
  "context-menu-sub",
  "dialog",
  "dropdown-menu",
  "dropdown-menu-sub",
  "hover-card",
  "popover",
  "select",
  "tooltip",
];
const POPUPS = [...POPUP_SLOTS.map((slot) => `[data-slot="${slot}-content"]`), "[data-sonner-toast]"].join(", ");

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export const isCoveredByPopup = (area: DOMRect) =>
  [...document.querySelectorAll(POPUPS)].some((popup) => overlaps(popup.getBoundingClientRect(), area));
