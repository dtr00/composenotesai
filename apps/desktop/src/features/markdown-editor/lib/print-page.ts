import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { printPage } from "../../../shared/api/windows";
import { loadMath } from "../../../shared/lib/math";
import { isWindows } from "../../../shared/lib/platform";

const PRINT_ROOT_CLASS = "print-root";
const MARGINS_INSIDE_CLASS = "print-margins-inside";
const PAGE_NUMBER_COLOR = "--print-page-number";

let printed: { host: HTMLElement; root: Root } | null = null;

function clearPrinted() {
  printed?.root.unmount();
  printed?.host.remove();
  printed = null;
  document.documentElement.style.removeProperty(PAGE_NUMBER_COLOR);
}

function placeMarginsInside(host: HTMLElement) {
  host.classList.add(MARGINS_INSIDE_CLASS);
  document.documentElement.style.setProperty(
    PAGE_NUMBER_COLOR,
    getComputedStyle(host).getPropertyValue("--muted-foreground"),
  );
}

async function whenLoaded(host: HTMLElement) {
  const images = [...host.querySelectorAll("img")].map((image) => image.decode().catch(() => undefined));
  await Promise.all([...images, document.fonts.ready, loadMath()]);
}

export async function printDocument(title: string, content: ReactNode) {
  clearPrinted();
  const host = document.createElement("div");
  host.className = `${PRINT_ROOT_CLASS} light`;
  document.body.append(host);
  if (isWindows) placeMarginsInside(host);
  const root = createRoot(host);
  printed = { host, root };
  flushSync(() => root.render(content));
  await whenLoaded(host);
  const previousTitle = document.title;
  document.title = title;
  try {
    await printPage();
  } finally {
    document.title = previousTitle;
  }
}
