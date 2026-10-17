import { Channel } from "@tauri-apps/api/core";
import { isRecord } from "../src/shared/lib/is-record";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { clearAiActivity } from "../src/entities/note/model/ai-activity";
import { loadNoteList } from "../src/entities/note/model/note-list-store";
import { systemPrompt } from "../src/features/ai-chat/lib/agent-prompt";
import { readSavedMessages } from "../src/features/ai-chat/lib/saved-chat";
import { toWire } from "../src/features/ai-chat/lib/wire";
import { agentTools } from "../src/features/ai-chat/model/agent-tools";
import { setChatHost } from "../src/features/ai-chat/model/chat-host";
import type { AssistantMessage, ToolPart } from "../src/features/ai-chat/model/conversation";
import { harnessFor, type HarnessUpdate } from "../src/features/ai-chat/model/harness";
import type { WireMessage } from "../src/shared/api/ai";
import { checker } from "./browser-kit";

type Rgb = [number, number, number];

const RED: Rgb = [224, 49, 49];
const BLUE: Rgb = [25, 113, 194];
const MAGENTA: Rgb = [255, 0, 255];
const GREEN: Rgb = [0, 200, 0];
const BLACK: Rgb = [0, 0, 0];

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;

function picture(): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.fillStyle = hex(GREEN);
  context.fillRect(0, 0, 64, 64);
  return canvas.toDataURL("image/png");
}

const base = { angle: 0, strokeWidth: 2, roughness: 0, opacity: 100, fillStyle: "solid", strokeStyle: "solid" };

function scene({ fill = RED, freehand = true, extra = [] as unknown[] } = {}) {
  const elements: unknown[] = [
    { ...base, id: "box", type: "rectangle", x: 0, y: 0, width: 300, height: 200, backgroundColor: hex(fill) },
    { ...base, id: "deleted", type: "rectangle", x: 0, y: 260, width: 300, height: 200, isDeleted: true },
    { ...base, id: "photo", type: "image", x: 360, y: 0, width: 200, height: 200, fileId: "pic", status: "saved" },
    {
      ...base,
      id: "label",
      type: "text",
      x: 0,
      y: 230,
      width: 240,
      height: 25,
      text: "Ship by Friday",
      originalText: "Ship by Friday",
      fontSize: 20,
      fontFamily: 5,
    },
    ...extra,
  ];
  if (freehand)
    elements.push({
      ...base,
      id: "scribble",
      type: "freedraw",
      x: 360,
      y: 260,
      width: 200,
      height: 120,
      strokeWidth: 8,
      strokeColor: hex(BLACK),
      points: Array.from({ length: 41 }, (_, i) => [i * 5, 60 + Math.sin(i / 3) * 60]),
      pressures: [],
      simulatePressure: true,
    });
  elements[1] = { ...(elements[1] as object), backgroundColor: hex(MAGENTA) };
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements,
    appState: { viewBackgroundColor: "#ffffff" },
    files: { pic: { id: "pic", mimeType: "image/png", dataURL: picture(), created: 1 } },
  });
}

async function pixels(mimeType: string, data: string) {
  const image = new Image();
  image.src = `data:${mimeType};base64,${data}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(image, 0, 0);
  const { data: rgba } = context.getImageData(0, 0, canvas.width, canvas.height);
  const count = ([r, g, b]: Rgb, tolerance = 40) => {
    let found = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (Math.abs(rgba[i] - r) + Math.abs(rgba[i + 1] - g) + Math.abs(rgba[i + 2] - b) < tolerance) found++;
    return found;
  };
  return { width: canvas.width, height: canvas.height, count };
}

function noise(size: number, seed: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  const image = context.createImageData(size, size);
  let state = seed;
  for (let i = 0; i < image.data.length; i++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    image.data[i] = i % 4 === 3 ? 255 : state % 256;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

const noisyScene = (seed: number) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: [
      { ...base, id: "noise", type: "image", x: 0, y: 0, width: 3000, height: 3000, fileId: "n", status: "saved" },
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: { n: { id: "n", mimeType: "image/png", dataURL: noise(3000, seed), created: 1 } },
  });

const remoteRequests = () =>
  performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith(location.origin) && !/^(data|blob):/.test(name));

export async function testDrawingVision() {
  const { passed, check } = checker();
  const drawing = { kind: "note" as const, id: 987672, title: "Sketch", parentId: null, format: "excalidraw" as const };
  const empty = { kind: "note" as const, id: 987673, title: "Blank", parentId: null, format: "excalidraw" as const };
  const markdown = { kind: "note" as const, id: 987674, title: "Text", parentId: null, format: "markdown" as const };
  let savedScene = scene();
  const requests: WireMessage[][] = [];
  const cancelled: string[] = [];
  let hangOn: number | null = null;
  let release = () => {};
  let afterFirst = () => {};
  mockWindows("main");
  mockIPC(
    (command, payload) => {
      if (command === "list_entries") return [drawing, empty, markdown];
      if (command === "load_note") {
        if (payload?.id === drawing.id) return { ...drawing, body: savedScene };
        if (payload?.id === empty.id)
          return { ...empty, body: JSON.stringify({ type: "excalidraw", version: 2, elements: [], files: {} }) };
        return { ...markdown, body: "Plain text" };
      }
      if (command === "save_note" && payload?.id === drawing.id && typeof payload.body === "string")
        savedScene = payload.body;
      if (command === "ai_chat") {
        if (
          !isRecord(payload?.request) ||
          !(payload.onEvent instanceof Channel) ||
          !Array.isArray(payload.request.messages)
        )
          throw new Error("Invalid chat request");
        requests.push(payload.request.messages as WireMessage[]);
        const emit = payload.onEvent.onmessage;
        if (requests.length === hangOn) return new Promise<void>((resolve) => (release = resolve));
        if (requests.length === 1) {
          emit({
            type: "toolCall",
            index: 0,
            id: "look",
            name: "view_drawing",
            arguments: JSON.stringify({ note_id: drawing.id }),
          });
          afterFirst();
        } else emit({ type: "text", delta: "A blue box, a green picture and a scribble." });
      }
      if (command === "ai_chat_cancel" && typeof payload?.runId === "string") {
        cancelled.push(payload.runId);
        release();
      }
    },
    { shouldMockEvents: true },
  );
  const { NOTE_TOOLS, readNoteForAi, revertAiChanges } = await import("../src/pages/notes/model/ai-note-tools");
  const { editNote, saveDrafts } = await import("../src/pages/notes/model/notes-store");
  const { drawingImage } = await import("../src/pages/notes/lib/excalidraw-image");
  const view = NOTE_TOOLS.find((tool) => tool.name === "view_drawing");
  if (!view) throw new Error("Missing view_drawing");
  setChatHost({
    tools: NOTE_TOOLS,
    readNote: readNoteForAi,
    revertNotes: revertAiChanges,
    tabNoteIds: () => [],
    openLink: () => {},
  });
  try {
    await loadNoteList();
    const tools = (vision: boolean) =>
      agentTools({ allowEdits: true, hasSkills: false, web: false, vision }).map((tool) => tool.name);
    check(
      tools(true).includes("view_drawing") && !tools(false).includes("view_drawing"),
      "Only models that can see images are offered view_drawing",
    );
    const prompt = (vision: boolean) =>
      systemPrompt({
        instructions: null,
        skills: [],
        loadedSkills: [],
        notes: [drawing],
        openNote: drawing,
        tabNotes: [],
        allowEdits: true,
        web: "off",
        vision,
        now: new Date(),
      });
    check(
      prompt(true).includes("call view_drawing") && prompt(false).includes("can't see images"),
      "The system prompt tells the model whether it can look at drawings",
    );

    const first = await view.run({ note_id: drawing.id }, "first");
    check(first.image !== undefined && first.noteId === drawing.id, "view_drawing returns a rendered image");
    const image = first.image!;
    check(
      image.mimeType === "image/png" && atob(image.data.slice(0, 8)).startsWith("\x89PNG"),
      "Drawings render to PNG",
    );
    const seen = await pixels(image.mimeType, image.data);
    check(seen.width === image.width && seen.height === image.height, "The reported size matches the image");
    check(seen.count(RED) > 1000, "Shapes are visible in the image");
    check(seen.count(GREEN) > 1000, "Embedded pictures are visible in the image");
    check(seen.count(MAGENTA) === 0, "Deleted elements are not rendered");
    const withoutScribble = await drawingImage(scene({ freehand: false }));
    const plain = await pixels(withoutScribble!.image.mimeType, withoutScribble!.image.data);
    check(seen.count(BLACK, 120) > plain.count(BLACK, 120) + 300, "Freehand strokes are visible in the image");
    check(
      first.result.includes("Ship by Friday") &&
        first.result.includes("attached as a") &&
        !first.result.includes(image.data),
      "The tool result carries the structure and size but not the image data",
    );
    check(
      !/base64|PNG|iVBOR/.test(first.result.split("\n\n").slice(2).join("")),
      "No image payload leaks into the structure",
    );
    check(
      remoteRequests().length === 0 &&
        performance.getEntriesByType("resource").some((entry) => entry.name.includes("/excalidraw/fonts/")),
      "Rendering loads fonts from the app, with no remote requests",
    );
    check((await drawingImage(savedScene)) === (await drawingImage(savedScene)), "Renders are cached by exact scene");

    editNote(drawing.id, scene({ fill: BLUE }));
    const edited = await view.run({ note_id: drawing.id }, "edited");
    const editedPixels = await pixels(edited.image!.mimeType, edited.image!.data);
    check(editedPixels.count(BLUE) > 1000 && editedPixels.count(RED) === 0, "Unsaved canvas edits are rendered");
    await saveDrafts();

    const blank = await view.run({ note_id: empty.id }, "blank");
    check(blank.image === undefined && blank.result.includes("empty"), "Empty drawings send no image");
    let rejected = false;
    try {
      await view.run({ note_id: markdown.id }, "markdown");
    } catch (error) {
      rejected = error instanceof Error && error.message.includes("not a drawing");
    }
    check(rejected, "view_drawing refuses Markdown notes");

    const huge = await drawingImage(
      scene({ extra: [{ ...base, id: "far", type: "rectangle", x: 20000, y: 12000, width: 50, height: 50 }] }),
    );
    check(
      huge !== null && Math.max(huge.image.width, huge.image.height) <= 1536 && huge.scale < 1,
      "Large boards are shrunk to the image limit",
    );
    check(huge!.image.data.length * 0.75 <= 1_500_000, "Encoded images stay under the byte limit");

    editNote(drawing.id, scene({ fill: RED }));
    const updates: HarnessUpdate[] = [];
    await harnessFor({ provider: "local", model: "vision" }).run({
      model: { provider: "local", model: "vision" },
      system: prompt(true),
      history: [{ id: "ask", role: "user", text: "What did I sketch?", attachments: [], sentAt: 0 }],
      tools: NOTE_TOOLS,
      seesImages: true,
      signal: new AbortController().signal,
      update: (update) => updates.push(update),
    });
    const second = requests[1] ?? [];
    check(
      second.map((message) => message.role).join(",") === "system,user,assistant,tool,user",
      "The image follows the tool result in its own message, keeping tool order valid",
    );
    const attached = second[4];
    const sent = attached?.role === "user" ? attached.images?.[0] : undefined;
    check(
      sent !== undefined && (await pixels(sent.mimeType, sent.data)).count(RED) > 1000,
      "The model receives the latest drawing",
    );
    check(!(second[3]?.content ?? "").includes(sent?.data ?? "-"), "The tool message itself has no image data");
    const part = updates.flatMap((update) => (update.type === "tool" && update.part.image ? [update.part] : [])).at(-1);
    check(part?.image?.data === sent?.data, "The chat keeps the exact image the model saw");

    const reply: AssistantMessage = {
      id: "reply",
      role: "assistant",
      model: "vision",
      skills: [],
      parts: [part as ToolPart, { kind: "text", text: "A red box." }],
      status: null,
      error: null,
      stats: null,
    };
    const saved = readSavedMessages(
      JSON.parse(
        JSON.stringify([{ id: "ask", role: "user", text: "What did I sketch?", attachments: [], sentAt: 0 }, reply]),
      ),
    );
    editNote(drawing.id, scene({ fill: BLUE }));
    await saveDrafts();
    const replayed = toWire(saved).find((message) => message.role === "user" && message.images?.length);
    check(
      replayed?.role === "user" && replayed.images?.[0].data === sent?.data,
      "Reopened chats replay the original image after the drawing changes",
    );
    requests.length = 0;
    await harnessFor({ provider: "local", model: "text" }).run({
      model: { provider: "local", model: "text" },
      system: prompt(false),
      history: [...saved, { id: "next", role: "user", text: "And now?", attachments: [], sentAt: 1 }],
      tools: NOTE_TOOLS,
      seesImages: false,
      signal: new AbortController().signal,
      update: () => {},
    });
    check(
      requests.length > 0 &&
        requests.every((sentMessages) =>
          sentMessages.every((message) => message.role !== "user" || !message.images?.length),
        ),
      "Earlier drawing images are not sent once the chat continues on a model that can't see images",
    );

    const viewRun = async (signal: AbortSignal) => {
      const steps: HarnessUpdate[] = [];
      await harnessFor({ provider: "local", model: "vision" }).run({
        model: { provider: "local", model: "vision" },
        system: prompt(true),
        history: [{ id: "ask", role: "user", text: "What did I sketch?", attachments: [], sentAt: 0 }],
        tools: NOTE_TOOLS,
        seesImages: true,
        signal,
        update: (update) => steps.push(update),
      });
      const parts = steps.flatMap((update) => (update.type === "tool" ? [update.part] : []));
      return parts.filter((step) => step.id === "look").at(-1);
    };

    const [timed, stopped] = [noisyScene(1), noisyScene(2)];
    await drawingImage(scene({ fill: GREEN }));
    let started = performance.now();
    const slow = await drawingImage(timed);
    const renderMs = performance.now() - started;
    check(
      slow?.image.mimeType === "image/jpeg" && slow.image.data.length * 0.75 <= 1_500_000,
      "Drawings too big for PNG fall back to JPEG within the byte limit",
    );

    editNote(drawing.id, stopped);
    requests.length = 0;
    const duringRender = new AbortController();
    afterFirst = () => window.setTimeout(() => duringRender.abort(), 30);
    const run = viewRun(duringRender.signal);
    await new Promise<void>((resolve) => duringRender.signal.addEventListener("abort", () => resolve()));
    started = performance.now();
    const stoppedView = await run;
    const stopMs = performance.now() - started;
    afterFirst = () => {};
    check(
      renderMs > 100 && stopMs < renderMs / 3,
      `Stop during rendering ends the run at once (${Math.round(stopMs)} ms, render takes ${Math.round(renderMs)} ms)`,
    );
    check(
      stoppedView?.status === "stopped" && stoppedView.image === undefined && requests.length === 1,
      `A view stopped mid-render keeps no image and sends nothing more to the model (${stoppedView?.status}, image ${stoppedView?.image !== undefined}, ${requests.length} request, stopped after ${Math.round(stopMs)} of ${Math.round(renderMs)} ms)`,
    );

    editNote(drawing.id, scene({ fill: RED }));
    requests.length = 0;
    hangOn = 2;
    const duringRequest = new AbortController();
    const waiting = viewRun(duringRequest.signal);
    while (requests.length < 2) await new Promise((resolve) => window.setTimeout(resolve, 10));
    duringRequest.abort();
    const sentView = await waiting;
    hangOn = null;
    const hung = requests[1].at(-1);
    check(
      hung?.role === "user" && hung.images?.length === 1 && cancelled.length === 1 && requests.length === 2,
      "Stop during the image request cancels it and sends nothing more",
    );
    check(
      sentView?.status === "done" && sentView.image !== undefined,
      "A view the model already received keeps its image",
    );
    const stoppedReply: AssistantMessage = { ...reply, id: "stopped", parts: [sentView as ToolPart], stopped: true };
    const next = toWire([
      { id: "ask", role: "user", text: "What did I sketch?", attachments: [], sentAt: 0 },
      stoppedReply,
      { id: "again", role: "user", text: "Try again", attachments: [], sentAt: 1 },
    ]);
    check(
      next.map((message) => message.role).join(",") === "user,assistant,tool,user,user",
      "After a stopped image request, the next question follows the attached image",
    );
  } finally {
    await saveDrafts();
    clearAiActivity();
    clearMocks();
  }
  return passed;
}
