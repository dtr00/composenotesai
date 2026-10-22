import { Channel } from "@tauri-apps/api/core";
import { isRecord } from "../src/shared/lib/is-record";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { clearAiActivity } from "../src/entities/note/model/ai-activity";
import { loadNoteList } from "../src/entities/note/model/note-list-store";
import { attachEntries, clearAttachments, takeAttachments } from "../src/features/ai-chat/model/attachments";
import { setChatHost } from "../src/features/ai-chat/model/chat-host";
import { systemPrompt } from "../src/features/ai-chat/lib/agent-prompt";
import { toWire } from "../src/features/ai-chat/lib/wire";
import { harnessFor, type HarnessUpdate } from "../src/features/ai-chat/model/harness";
import { notePath } from "../src/shared/config/routes";
import { navigate } from "../src/shared/lib/hash-router";
import { checker } from "./browser-kit";

export async function testAiDrawings() {
  const { passed, check } = checker();
  const drawing = {
    kind: "note" as const,
    id: 987662,
    title: "Request flow",
    parentId: 987663,
    format: "excalidraw" as const,
  };
  const markdown = {
    kind: "note" as const,
    id: 987664,
    title: "Plain note",
    parentId: null,
    format: "markdown" as const,
  };
  const folder = { kind: "folder" as const, id: 987663, name: "Diagrams", parentId: null, collapsed: false };
  const scene = JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: [
      { id: "request", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
      { id: "request-text", type: "text", containerId: "request", text: "Customer request" },
      { id: "approval", type: "diamond", x: 200, y: 0, width: 100, height: 60 },
      { id: "approval-text", type: "text", containerId: "approval", text: "Approval" },
      {
        id: "edge",
        type: "arrow",
        startBinding: { elementId: "request" },
        endBinding: { elementId: "approval" },
        endArrowhead: "arrow",
      },
      { id: "deleted", type: "text", text: "Deleted secret", isDeleted: true },
    ],
    appState: {},
    files: { photo: { dataURL: "data:image/png;base64,PrivateImage" } },
  });
  const writes: string[] = [];
  let savedScene = scene;
  const modelInputs: string[] = [];
  mockWindows("main");
  mockIPC(
    (command, payload) => {
      if (command === "list_entries") return [folder, drawing, markdown];
      if (command === "ai_models")
        return [
          {
            provider: "local",
            name: "Local AI",
            kind: "local",
            error: null,
            models: [{ id: "test-model", name: "Test model", sizeBytes: null, details: null, vision: false }],
          },
        ];
      if (command === "load_note")
        return payload?.id === drawing.id ? { ...drawing, body: savedScene } : { ...markdown, body: "Plain Markdown" };
      if (command === "save_note" && typeof payload?.body === "string") {
        writes.push(payload.body);
        if (payload.id === drawing.id) savedScene = payload.body;
      }
      if (command === "ai_chat") {
        if (!isRecord(payload?.request) || !(payload.onEvent instanceof Channel))
          throw new Error("Invalid chat request");
        check(payload.request.provider === "local", "Drawing context reaches the local provider");
        modelInputs.push(JSON.stringify(payload.request.messages));
        const emit = payload.onEvent.onmessage;
        if (modelInputs.length === 1)
          emit({
            type: "toolCall",
            index: 0,
            id: "read-drawing",
            name: "read_note",
            arguments: JSON.stringify({ note_id: drawing.id }),
          });
        else emit({ type: "text", delta: "The customer request connects to approval." });
      }
    },
    { shouldMockEvents: true },
  );
  const { NOTE_TOOLS, readNoteForAi, revertAiChanges } = await import("../src/pages/notes/model/ai-note-tools");
  const { editNote, readNoteBody, saveDrafts } = await import("../src/pages/notes/model/notes-store");
  const tool = (name: string) => {
    const found = NOTE_TOOLS.find((tool) => tool.name === name);
    if (!found) throw new Error(`Missing ${name}`);
    return found;
  };
  setChatHost({
    tools: NOTE_TOOLS,
    readNote: readNoteForAi,
    revertNotes: revertAiChanges,
    tabNoteIds: () => [drawing.id],
    openLink: () => {},
  });
  try {
    await loadNoteList();
    const read = await tool("read_note").run({ note_id: drawing.id }, "read");
    check(
      read.result.includes('"label":"Customer request"') && read.result.includes('"elementId":"approval"'),
      "Read-note tools describe drawing labels and connector relationships",
    );
    check(
      !read.result.includes("PrivateImage") && !read.result.includes("Deleted secret"),
      "AI reads omit deleted elements and embedded image payloads",
    );
    check(
      (await tool("list_notes").run({}, "list")).result.includes("Excalidraw drawing"),
      "Note listings identify drawings",
    );
    check((await readNoteForAi(markdown.id))?.body === "Plain Markdown", "Markdown reads keep their original content");
    editNote(drawing.id, scene.replace("Customer request", "Unsaved request"));
    check(
      (await readNoteForAi(drawing.id))?.body.includes("Unsaved request") === true,
      "AI reads include unsaved drawing changes",
    );
    attachEntries([{ kind: "note", id: drawing.id }]);
    const attached = await takeAttachments();
    check(
      attached[0]?.content.includes("Unsaved request") === true && !attached[0].content.includes("PrivateImage"),
      "Drawing attachments use the same readable context",
    );
    attachEntries([{ kind: "folder", id: folder.id }]);
    const attachedFolder = await takeAttachments();
    check(
      attachedFolder[0]?.content.includes("Excalidraw drawing") === true,
      "Folder attachments include drawing context",
    );
    check(
      toWire([
        { id: "question", role: "user", text: "Explain this", attachments: attached, sentAt: 0 },
      ])[0].content.includes('"elementId":"approval"'),
      "Model messages retain diagram connections from attachments",
    );
    await saveDrafts();
    const before = writes.length;
    for (const name of ["write_note", "append_to_note", "replace_in_note"]) {
      const edit = tool(name);
      edit.preview?.(`preview-${name}`, { note_id: drawing.id, content: "Broken scene" });
      let rejected = false;
      try {
        await edit.run({ note_id: drawing.id, content: "Broken scene", find: "request", replace: "Changed" }, name);
      } catch (error) {
        rejected = error instanceof Error && error.message.includes("Markdown editing tools cannot change");
      }
      check(rejected, `${name} rejects drawings before changing or previewing their bodies`);
    }
    await saveDrafts();
    check(
      writes.length === before && (await readNoteBody(drawing.id)) === savedScene,
      "Rejected Markdown edits leave saved drawing data intact",
    );
    const system = systemPrompt({
      instructions: "Custom agent instructions",
      skills: [],
      loadedSkills: [],
      command: null,
      notes: [drawing, markdown],
      openNote: drawing,
      tabNotes: [],
      allowEdits: true,
      web: "off",
      vision: false,
      now: new Date(),
    });
    check(
      system.includes('looking at the Excalidraw drawing "Request flow"') &&
        system.includes("Markdown writing tools cannot edit drawings"),
      "The model recognizes the active drawing even with custom agent instructions",
    );
    const updates: HarnessUpdate[] = [];
    await harnessFor({ provider: "local", model: "test-model" }).run({
      model: { provider: "local", model: "test-model" },
      system,
      history: [{ id: "request", role: "user", text: "Explain this drawing", attachments: [], sentAt: 0 }],
      tools: NOTE_TOOLS,
      seesImages: false,
      signal: new AbortController().signal,
      update: (update) => updates.push(update),
    });
    check(
      modelInputs.length === 2 && modelInputs[1].includes("Unsaved request") && modelInputs[1].includes("approval"),
      "The local AI harness returns drawing tool results to the model",
    );
    check(
      updates.some(
        (update) => update.type === "tool" && update.part.status === "done" && update.part.name === "read_note",
      ),
      "Drawing reads complete in the existing AI tool flow",
    );
    const { createElement } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { flushSync } = await import("react-dom");
    const { ChatEmpty } = await import("../src/features/ai-chat/ui/chat-empty");
    const { MentionPicker } = await import("../src/features/ai-chat/ui/mention-picker");
    const { PendingAttachments } = await import("../src/features/ai-chat/ui/pending-attachments");
    const { SentAttachments } = await import("../src/features/ai-chat/ui/sent-attachments");
    const { refreshModels } = await import("../src/features/ai-chat/model/models-store");
    await refreshModels();
    navigate(notePath(drawing.id));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      flushSync(() =>
        root.render(
          createElement(MentionPicker, {
            items: [drawing, markdown, { kind: "folder", id: folder.id, title: folder.name }],
            highlighted: 0,
            onPick: () => {},
            onHighlight: () => {},
          }),
        ),
      );
      const options = container.querySelectorAll('[role="option"]');
      check(
        options.length === 3 &&
          options[0].querySelector(".lucide-pencil-ruler") !== null &&
          options[1].querySelector(".lucide-file-text") !== null &&
          options[2].querySelector(".lucide-folder") !== null,
        "Attachment suggestions distinguish drawings, Markdown notes and folders",
      );
      flushSync(() => {
        attachEntries([{ kind: "note", id: drawing.id }]);
        root.render(createElement(PendingAttachments));
      });
      check(
        container.querySelector(".lucide-pencil-ruler") !== null,
        "Pending drawing attachments use the drawing icon",
      );
      const sentAttachments = await takeAttachments();
      flushSync(() => root.render(createElement(SentAttachments, { attachments: sentAttachments })));
      const trigger = container.querySelector("button");
      flushSync(() => trigger?.click());
      check(container.querySelector(".lucide-pencil-ruler") !== null, "Sent drawing attachments use the drawing icon");
      flushSync(() => root.render(createElement(ChatEmpty)));
      check(
        container.textContent?.includes("Explain this drawing") === true &&
          !container.textContent.includes("Clean up the formatting"),
        "The AI panel offers drawing questions for an active drawing",
      );
    } finally {
      flushSync(() => root.unmount());
      container.remove();
    }
  } finally {
    await saveDrafts();
    clearAttachments();
    clearAiActivity();
    clearMocks();
  }
  return passed;
}
