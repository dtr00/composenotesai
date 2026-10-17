const flushStyles = () => getComputedStyle(document.documentElement).color;

export function withoutTransitions(change: () => void) {
  const style = document.createElement("style");
  style.textContent = "*, *::before, *::after { transition: none !important; }";
  document.head.append(style);
  change();
  flushStyles();
  style.remove();
}
