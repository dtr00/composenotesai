import { mockIPC, mockWindows, clearMocks } from "@tauri-apps/api/mocks";
import { domAnimation, LazyMotion } from "motion/react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { loadNoteList } from "../src/entities/note/model/note-list-store";
import { appHotkeys, hotkeyFor, listenForHotkeys, setHotkey } from "../src/entities/settings/model/keybindings";
import { getSettings, startSettings } from "../src/entities/settings/model/settings-store";
import { startTabs, watchTabs } from "../src/features/tabs/model/tabs-store";
import { NEW_TAB_PATH, notePath } from "../src/shared/config/routes";
import { currentPath, navigate } from "../src/shared/lib/hash-router";
import { hotkey, type Hotkey } from "../src/shared/lib/hotkeys";
import { isMacOS } from "../src/shared/lib/platform";
import "../src/app/styles.css";
import { checker, testSettings } from "./browser-kit";

export async function testNewTabActions() {
  const { passed, check } = checker();
  let listFails = true;
  let drawingId = 987658;
  const commands: string[] = [];
  mockWindows("main");
  mockIPC(
    (command, payload) => {
      commands.push(command === "create_note" ? `create_note:${String(payload?.format)}` : command);
      if (command === "list_entries") {
        if (listFails) throw new Error("Note list unavailable");
        return [];
      }
      if (command === "create_note" && payload?.format === "excalidraw")
        return { id: ++drawingId, title: "Untitled excalidraw note", parentId: null, format: "excalidraw" };
    },
    { shouldMockEvents: true },
  );
  startSettings(testSettings({ sidebarOpen: false, theme: "dark", backgroundStyle: "dither" }));
  navigate(NEW_TAB_PATH);
  startTabs(null, false);
  const { NotesPage } = await import("../src/pages/notes/page");
  const { createExcalidrawInNewTab } = await import("../src/pages/notes/model/notes-store");
  const container = document.createElement("div");
  container.style.cssText = "height:650px;display:flex";
  document.body.append(container);
  const root = createRoot(container);
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const actions = () => Array.from(container.querySelectorAll<HTMLButtonElement>("main button"));
  const labels = ["New note", "New Excalidraw note", "New folder", "Open browser"];
  const hasActions = () => labels.every((label) => actions().some((button) => button.textContent?.includes(label)));
  const press = (binding: Hotkey, repeat = false) =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: binding.key,
        code: `Key${binding.key.toUpperCase()}`,
        ctrlKey: !isMacOS && binding.mod,
        metaKey: isMacOS && binding.mod,
        altKey: binding.alt,
        shiftKey: binding.shift,
        repeat,
        bubbles: true,
        cancelable: true,
      }),
    );
  let tabCount = 1;
  const stopTabs = watchTabs((tabs) => {
    tabCount = tabs.length;
  });
  try {
    flushSync(() =>
      root.render(createElement(LazyMotion, { features: domAnimation, strict: true }, createElement(NotesPage))),
    );
    await frame();
    check(hasActions(), "All four splash options remain visible while the note list loads");
    await loadNoteList();
    await frame();
    check(hasActions(), "A note-list failure does not hide splash options");
    const drawing = actions().find((button) => button.textContent?.includes("New Excalidraw note"));
    if (!drawing) throw new Error("Drawing action missing");
    const bounds = drawing.getBoundingClientRect();
    check(
      document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest("button") ===
        drawing,
      "The drawing option is visible and receives pointer input",
    );
    listFails = false;
    drawing.click();
    for (let attempt = 0; attempt < 60 && currentPath() !== notePath(987659); attempt++) await frame();
    check(
      commands.includes("create_note:excalidraw") && currentPath() === notePath(987659),
      "The splash drawing option creates and opens an Excalidraw note",
    );
    const noop = () => {};
    listenForHotkeys({
      newNote: noop,
      newExcalidrawNote: () => void createExcalidrawInNewTab(),
      newTab: noop,
      openBrowser: noop,
      closeTab: noop,
      toggleSidebar: noop,
      toggleChat: noop,
      openSettings: noop,
    });
    const defaultBinding = hotkeyFor("newExcalidrawNote");
    check(
      defaultBinding.mod && defaultBinding.shift && defaultBinding.key === "n",
      "New drawings default to Ctrl or Cmd + Shift + N",
    );
    press(defaultBinding);
    for (let attempt = 0; attempt < 60 && currentPath() !== notePath(987660); attempt++) await frame();
    check(
      currentPath() === notePath(987660) && tabCount === 2,
      "The drawing shortcut opens a new tab from an existing note",
    );
    press(defaultBinding, true);
    await frame();
    check(drawingId === 987660, "Holding the drawing shortcut does not create repeated notes");
    navigate(NEW_TAB_PATH);
    setHotkey("newExcalidrawNote", hotkey("n", { mod: true, alt: true }));
    await frame();
    const customBinding = hotkeyFor("newExcalidrawNote");
    check(
      customBinding.alt &&
        !customBinding.shift &&
        appHotkeys(getSettings()).some((binding) => binding.action === "newExcalidrawNote" && binding.alt),
      "A custom drawing shortcut is used by both the app and embedded browser bindings",
    );
    press(defaultBinding);
    await frame();
    check(drawingId === 987660, "Customizing the drawing shortcut replaces its default binding");
    press(customBinding);
    for (let attempt = 0; attempt < 60 && currentPath() !== notePath(987661); attempt++) await frame();
    check(currentPath() === notePath(987661) && tabCount === 2, "A custom drawing shortcut reuses a blank tab");
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    stopTabs();
    clearMocks();
  }
  return passed;
}
