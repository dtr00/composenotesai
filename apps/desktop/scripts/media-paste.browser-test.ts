import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { history, undo } from "@codemirror/commands";
import { loadMediaConfig, type MediaSummary } from "../src/shared/api/notes";
import { mediaInsertion, type MediaSource } from "../src/features/markdown-editor/lib/media-insert";
import { checker, waitFor } from "./browser-kit";

export async function testMediaPaste() {
  const { passed, check } = checker();
  mockIPC((command) => {
    if (command === "media_config") {
      return {
        base: "http://localhost/media",
        formats: [{ mime: "image/png", extensions: ["png"], mediaType: "image", label: "PNG" }],
      };
    }
    throw new Error(`Unexpected command: ${command}`);
  });
  await loadMediaConfig();
  const parent = document.body.appendChild(document.createElement("div"));
  const saved: MediaSource[] = [];
  let unreadable = 0;
  let imageReads = 0;
  let fileReads = 0;
  const image = new File(["pixels"], "image.png", { type: "image/png" });
  let readImage = async (): Promise<File | null> => image;
  const media: MediaSummary = {
    id: 7,
    name: "Pasted image.png",
    parentId: null,
    mime: "image/png",
    mediaType: "image",
    bytes: image.size,
  };
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: "Keep this text",
      extensions: [
        history(),
        mediaInsertion({
          save: async (source) => {
            saved.push(source);
            return media;
          },
          copiedFiles: async () => {
            fileReads++;
            return ["/pictures/copied.png"];
          },
          copiedImage: async () => {
            imageReads++;
            return readImage();
          },
          onUnreadable: () => unreadable++,
        }),
      ],
    }),
  });
  const paste = (data: DataTransfer) => {
    const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    const html = new DataTransfer();
    html.setData("text/html", "<img>");
    check(paste(html), "HTML-only image pastes are handled");
    await waitFor(() => saved.length === 1);
    await waitFor(() => view.state.doc.toString().includes("image:7"));
    check(saved[0] === image && unreadable === 0, "WebKit's hidden clipboard image is saved as a local file");
    check(view.state.doc.toString().endsWith("Keep this text"), "Image insertion preserves surrounding note text");

    const file = new DataTransfer();
    file.items.add(image);
    paste(file);
    await waitFor(() => saved.length === 2);
    check(imageReads === 1, "Exposed clipboard files do not trigger a second native image read");

    const text = new DataTransfer();
    text.setData("text/plain", "Ordinary text");
    text.setData("text/html", "<p>Ordinary text <img src='https://example.com/picture.png'></p>");
    paste(text);
    check(imageReads === 1, "Rich text containing an image keeps normal text paste behavior");

    const copiedFile = new DataTransfer();
    copiedFile.setData("text/uri-list", "");
    paste(copiedFile);
    await waitFor(() => saved.length === 3);
    check(
      saved[2] === "/pictures/copied.png" && fileReads === 1 && imageReads === 1,
      "Hidden file-manager paths still use the native file fallback",
    );

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "Keep this text" },
      selection: { anchor: 0, head: 4 },
    });
    readImage = async () => null;
    paste(html);
    await waitFor(() => unreadable === 1);
    check(
      view.state.doc.toString() === "Keep this text" && view.state.selection.main.to === 4,
      "An unavailable native image reports an error without deleting selected text",
    );

    readImage = async () => {
      throw new Error("Clipboard unavailable");
    };
    paste(html);
    await waitFor(() => unreadable === 2);
    check(view.state.doc.toString() === "Keep this text", "Native clipboard failures preserve the note");

    readImage = async () => image;
    paste(html);
    await waitFor(() => view.state.doc.toString().startsWith("![Pasted image.png]"));
    check(view.state.doc.toString().endsWith(" this text"), "A successful image paste replaces the selected text");
    undo(view);
    check(view.state.doc.toString() === "Keep this text", "One undo restores the text replaced by an image");

    let finishRead: (file: File | null) => void = () => {
      throw new Error("Read not started");
    };
    readImage = () =>
      new Promise((resolve) => {
        finishRead = resolve;
      });
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    paste(html);
    view.dispatch({ changes: { from: 0, insert: "New " }, selection: { anchor: 0 } });
    finishRead(image);
    await waitFor(() => view.state.doc.toString().includes("image:7"));
    check(
      view.state.doc.toString().startsWith("New Keep this text\n"),
      "A delayed image paste follows edits before its insertion point",
    );
    check(view.state.selection.main.head === 0, "A delayed image paste leaves a moved cursor alone");

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "Old text" },
      selection: { anchor: 0, head: 3 },
    });
    paste(html);
    view.dispatch({ changes: { from: 0, to: 3, insert: "New" }, selection: { anchor: 3 } });
    finishRead(image);
    await waitFor(() => view.state.doc.toString().includes("image:7"));
    check(
      view.state.doc.toString().endsWith("New text"),
      "Typing over a pending paste selection preserves the new text",
    );
  } finally {
    view.destroy();
    parent.remove();
    clearMocks();
  }
  return passed;
}
