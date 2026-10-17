import { closeCompletion, completionStatus, startCompletion } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startSettings } from "../src/entities/settings/model/settings-store";
import { listNote, setTitleDraft } from "../src/entities/note/model/note-list-store";
import { loadMediaConfig } from "../src/shared/api/notes";
import { checker, testSettings } from "./browser-kit";

export async function testNoteNavigation() {
  const { passed, check } = checker();
  const writes: string[] = [];
  mockIPC((command, payload) => {
    if (command === "media_config") return { base: "http://localhost/media", formats: [] };
    if (command === "rename_note") {
      writes.push(command);
      return payload?.title;
    }
    if (command === "save_note") writes.push(command);
  });
  mockWindows("main");
  startSettings(testSettings());
  const { saveDrafts } = await import("../src/pages/notes/model/notes-store");
  const { NoteEditor } = await import("../src/pages/notes/ui/note-editor");
  await loadMediaConfig();
  const parent = document.createElement("div");
  parent.style.cssText = "width: 320px; margin: 40px;";
  document.body.append(parent);
  const root = createRoot(parent);
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const press = (target: HTMLElement, key: string, options: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  try {
    listNote({ id: 987654, title: "Navigation title", parentId: null, format: "markdown" });
    flushSync(() =>
      root.render(
        createElement(NoteEditor, { note: { id: 987654, format: "markdown", body: "First line\nSecond line" } }),
      ),
    );
    await frame();
    const title = parent.querySelector("input");
    const content = parent.querySelector<HTMLElement>(".cm-content");
    const view = content && EditorView.findFromDOM(content);
    if (!title || !content || !view) throw new Error("Editor did not mount");
    const focusBody = (anchor: number, head = anchor) => {
      view.dispatch({ selection: { anchor, head } });
      view.focus();
    };
    focusBody(4);
    press(content, "ArrowUp");
    check(
      document.activeElement === title && title.selectionStart === title.value.length,
      "Up moves to the end of the title by default",
    );
    title.setSelectionRange(4, 4);
    press(title, "ArrowDown");
    check(view.hasFocus && view.state.selection.main.head === 0, "Down always moves to the start of the body");
    press(content, "ArrowUp");
    check(
      document.activeElement === title && title.selectionStart === 4,
      "Up restores the cursor position saved when leaving the title",
    );
    title.setSelectionRange(7, 7);
    press(title, "ArrowDown");
    focusBody(3);
    press(content, "ArrowUp");
    check(title.selectionStart === 7, "Each departure updates the remembered title position");
    focusBody(15);
    press(content, "ArrowUp");
    check(
      view.hasFocus && view.state.doc.lineAt(view.state.selection.main.head).number === 1,
      "Up from the second body line stays in the body",
    );
    focusBody(0, 4);
    press(content, "ArrowUp");
    check(view.hasFocus, "Up with selected text stays in the body");
    focusBody(4);
    press(content, "ArrowUp", { shiftKey: true });
    check(view.hasFocus, "Shift+Up keeps selection in the body");
    title.focus();
    title.setSelectionRange(3, 3);
    press(title, "ArrowDown", { ctrlKey: true });
    check(document.activeElement === title, "Modified Down is not intercepted");
    press(title, "Enter", { isComposing: true, keyCode: 229 });
    check(document.activeElement === title, "IME confirmation keeps focus in the title");
    flushSync(() => setTitleDraft(987654, "Edited title"));
    title.setSelectionRange(2, 2);
    press(title, "Enter");
    await saveDrafts();
    check(view.hasFocus && view.state.selection.main.head === 0, "Enter moves to the start of the body");
    check(writes.includes("rename_note"), "Leaving the title saves its draft");
    press(content, "ArrowUp");
    check(title.selectionStart === 2, "Enter also remembers the title cursor position");
    press(title, "ArrowDown");
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" }, selection: { anchor: 0 } });
    press(content, "ArrowUp");
    check(document.activeElement === title, "An empty body can move up to the title");
    title.setSelectionRange(title.value.length, title.value.length);
    press(title, "ArrowDown");
    check(view.hasFocus && view.state.selection.main.head === 0, "Down enters an empty body safely");
    view.dispatch({ changes: { from: 0, insert: "A long first line with words ".repeat(20) } });
    await frame();
    const wrapped = view.moveVertically(EditorSelection.cursor(4), true);
    check(wrapped.head > 4, "The long first line wraps in the browser");
    view.dispatch({ selection: wrapped });
    press(content, "ArrowUp");
    check(view.hasFocus, "Up from a wrapped continuation stays in the body");
    focusBody(4);
    press(content, "ArrowUp");
    check(document.activeElement === title, "Up from the first visual line reaches the title");
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "/" },
      selection: { anchor: 1 },
      userEvent: "input.type",
    });
    view.focus();
    startCompletion(view);
    for (let attempt = 0; attempt < 30 && completionStatus(view.state) !== "active"; attempt++) await frame();
    check(completionStatus(view.state) === "active", "Slash completion opens");
    press(content, "ArrowUp");
    check(
      view.hasFocus && completionStatus(view.state) === "active",
      "Up navigates completion without leaving the body",
    );
    closeCompletion(view);
    press(content, "ArrowUp");
    check(document.activeElement === title, "Up reaches the title after completion closes");
    await saveDrafts();
    check(writes.includes("save_note"), "Leaving the body saves its draft");
    listNote({ id: 987655, title: "Another title", parentId: null, format: "markdown" });
    flushSync(() =>
      root.render(createElement(NoteEditor, { note: { id: 987655, format: "markdown", body: "Another body" } })),
    );
    const nextContent = parent.querySelector<HTMLElement>(".cm-content");
    const nextTitle = parent.querySelector("input");
    if (!nextContent || !nextTitle) throw new Error("Next note did not mount");
    press(nextContent, "ArrowUp");
    check(
      document.activeElement === nextTitle && nextTitle.selectionStart === nextTitle.value.length,
      "Switching notes resets the remembered title position",
    );
    return passed;
  } finally {
    root.unmount();
    parent.remove();
    await saveDrafts();
    clearMocks();
  }
}
