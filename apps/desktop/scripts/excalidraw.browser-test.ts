import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { createElement, StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { drawingPreview } from "../src/pages/notes/lib/excalidraw-context";
import type { OpenNote } from "../src/pages/notes/model/notes-store";
import "../src/app/styles.css";
import { checker, waitFor } from "./browser-kit";

export async function testExcalidrawEditor() {
  const { passed, check } = checker();
  const writes: string[] = [];
  const commands: string[] = [];
  mockWindows("main");
  const { saveDrafts } = await import("../src/pages/notes/model/notes-store");
  const { ExcalidrawEditor } = await import("../src/pages/notes/ui/excalidraw-editor");
  mockIPC((command, payload) => {
    commands.push(command);
    if (command === "save_note" && typeof payload?.body === "string") writes.push(payload.body);
  });
  const container = document.createElement("div");
  container.style.cssText = "width:100%;height:650px;display:flex;flex-direction:column";
  document.body.append(container);
  const root = createRoot(container);
  const scene = {
    type: "excalidraw",
    version: 2,
    elements: [
      { id: "agent-box", type: "rectangle", x: 50, y: 50, width: 160, height: 80, customData: { agent: true } },
      {
        id: "agent-text",
        type: "text",
        x: 250,
        y: 50,
        width: 160,
        height: 25,
        text: "Local fonts",
        fontFamily: 5,
        fontSize: 20,
      },
    ],
    appState: {},
    files: {},
  };
  const note: OpenNote = { id: 987657, format: "excalidraw", body: JSON.stringify(scene) };
  const render = () =>
    flushSync(() => root.render(createElement(StrictMode, null, createElement(ExcalidrawEditor, { note }))));
  const checkTheme = (theme: string) => {
    const editor = container.querySelector<HTMLElement>(".excalidraw");
    const toolbar = container.querySelector<HTMLElement>(".App-toolbar");
    const selectedTool = container.querySelector<HTMLElement>(".ToolIcon_type_radio:checked + .ToolIcon__icon");
    if (!editor || !toolbar || !selectedTool) throw new Error("Drawing controls did not render");
    const probe = document.createElement("span");
    probe.style.cssText = "background:var(--popover);color:var(--foreground)";
    container.append(probe);
    check(
      getComputedStyle(toolbar).backgroundColor === getComputedStyle(probe).backgroundColor &&
        getComputedStyle(editor).color === getComputedStyle(probe).color,
      `${theme} drawing controls use the app background and foreground`,
    );
    probe.style.cssText = "background:var(--primary);color:var(--primary-foreground)";
    const icon = selectedTool.querySelector("svg");
    check(
      getComputedStyle(selectedTool).backgroundColor === getComputedStyle(probe).backgroundColor &&
        !!icon &&
        getComputedStyle(icon).color === getComputedStyle(probe).color,
      `${theme} selected tools use the app accent and its foreground`,
    );
    probe.remove();
    check(
      Array.from(container.querySelectorAll(".default-sidebar-trigger, .help-icon")).every(
        (button) => getComputedStyle(button).display === "none",
      ),
      `${theme} drawing controls hide the library and help buttons`,
    );
  };
  try {
    render();
    await waitFor(() => !!container.querySelector(".excalidraw"));
    check(
      !container.querySelector("iframe") && !container.textContent?.includes("Download"),
      "Drawings open directly with the bundled editor",
    );
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    check(writes.length === 0, "Opening a drawing does not rewrite it");
    const nudge = async () => {
      const editor = container.querySelector<HTMLElement>(".excalidraw");
      editor?.focus();
      for (const init of [
        { key: "a", code: "KeyA", ctrlKey: true },
        { key: "ArrowRight", code: "ArrowRight" },
      ]) {
        editor?.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }));
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
    };
    await nudge();
    await waitFor(() => writes.length > 0);
    checkTheme("Light");
    const menu = container.querySelector<HTMLButtonElement>('[data-testid="main-menu-trigger"]');
    if (!menu) throw new Error("Drawing menu did not render");
    menu.click();
    await waitFor(() => !!container.querySelector('[data-testid="clear-canvas-button"]'));
    check(
      !container.querySelector(
        '[data-testid="load-button"], [data-testid="save-button"], [data-testid="json-export-button"]',
      ),
      "The drawing menu omits Open and Save to",
    );
    menu.click();
    check(
      commands.every((command) => command === "save_note"),
      "Opening a drawing needs no plugin commands",
    );
    const saved: unknown = JSON.parse(writes[0]);
    check(
      typeof saved === "object" && saved !== null && "type" in saved && saved.type === "excalidraw",
      "Real Excalidraw scene changes reach native autosave",
    );
    check(
      writes[0].includes("agent-box") && writes[0].includes('"agent": true'),
      "Agent-created elements and custom data survive restoration",
    );
    check(drawingPreview(writes[0])?.elements === 2, "Drawing previews show scene elements instead of JSON");
    await document.fonts.load("20px Excalifont", "Local fonts");
    const fonts = performance.getEntriesByType("resource").filter((entry) => entry.name.endsWith(".woff2"));
    check(
      fonts.length > 0 && fonts.every((entry) => entry.name.startsWith(location.origin)),
      "Drawing fonts load from the app without CDN requests",
    );
    document.documentElement.classList.add("dark");
    await waitFor(() => !!container.querySelector(".theme--dark"));
    check(true, "The canvas follows the app theme");
    checkTheme("Dark");
    const before = writes.length;
    flushSync(() => root.render(null));
    render();
    await waitFor(() => !!container.querySelector(".excalidraw"));
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    check(writes.length === before, "Reopening an unchanged drawing does not rewrite it");
    await nudge();
    await waitFor(() => writes.length > before);
    check(writes.at(-1)?.includes("agent-box") === true, "Reopening a drawing restores the latest saved scene");
  } finally {
    flushSync(() => root.unmount());
    await saveDrafts();
    container.remove();
    document.documentElement.classList.remove("dark");
    clearMocks();
  }
  return passed;
}
