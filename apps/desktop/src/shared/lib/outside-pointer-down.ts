export function onPointerDownOutside(inside: string, handler: () => void) {
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target instanceof Element && event.target.closest(inside)) return;
      handler();
    },
    { capture: true },
  );
}
