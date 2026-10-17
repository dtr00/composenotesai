import { Eye, FilePen, FilePlus, FileSearch, FileText, FolderTree, TextCursorInput } from "lucide-react";
import {
  finishAiWriting,
  showAiReading,
  startAiWriting,
  stopAiWriting,
} from "../../../entities/note/model/ai-activity";
import { getEntries, renameEntry, savedNoteTitle } from "../../../entities/note/model/note-list-store";
import { drawingTag, isDrawing } from "../../../entities/note/lib/note-format";
import { findEntry, visibleRows } from "../../../entities/note/model/note-tree";
import type { AgentTool, ToolVerbs } from "../../../features/ai-chat/model/agent-tools";
import type { HostNote } from "../../../features/ai-chat/model/chat-host";
import type { NoteChange } from "../../../features/ai-chat/model/conversation";
import { firstChangePerNote } from "../../../features/ai-chat/lib/note-changes";
import { idArg, requiredString, stringArg, type ToolArgs } from "../../../features/ai-chat/lib/tool-args";
import { openInNewTab } from "../../../features/tabs/model/tabs-store";
import { searchNotes, type Entry, type NoteEntry, type NoteFormat, type SearchHit } from "../../../shared/api/notes";
import { reportAction } from "../../../shared/lib/error-toast";
import { createListedNote, readNoteBody, saveDrafts, showNoteBody, writeNoteBody } from "./notes-store";
import { moveToTrash } from "./trash-history";
import { drawingContext } from "../lib/excalidraw-context";
import { drawingImage, type DrawingImage } from "../lib/excalidraw-image";

const SEARCH_RESULTS = 8;
const MAX_LISTED = 300;
const MAX_READ_CHARS = 30_000;

type WriteMode = "replace" | "append";

interface Preview {
  noteId: number;
  base: Promise<string>;
}

const previews = new Map<string, Preview>();

const NOTE_ID = { type: "integer", description: "The note id, for example 12." };

const noteIdOf = (args: ToolArgs) => idArg(args, "note_id") ?? idArg(args, "noteId");

const findNote = (id: number | null): NoteEntry | undefined =>
  id === null ? undefined : findEntry(getEntries(), { kind: "note", id });

const WRONG_FORMAT: Record<NoteFormat, string> = {
  markdown: "This is an Excalidraw drawing. Markdown editing tools cannot change it. Use read_note to understand it.",
  excalidraw: "This is a Markdown note, not a drawing. Use read_note to read it.",
};

function noteOfFormat(args: ToolArgs, format: NoteFormat): NoteEntry {
  const note = existingNote(args);
  if (isDrawing(note.format) !== isDrawing(format)) throw new Error(WRONG_FORMAT[format]);
  return note;
}

const quoted = (id: number | null) => {
  const title = findNote(id)?.title;
  return title ? `“${title}”` : "note";
};

type EditedNote = Extract<NoteChange, { kind: "edited" }>;

async function snapshot({ id, title }: NoteEntry): Promise<EditedNote> {
  return { kind: "edited", noteId: id, before: { title, body: await readNoteBody(id) } };
}

function existingNote(args: ToolArgs): NoteEntry {
  const note = findNote(noteIdOf(args));
  if (!note) throw new Error("There's no note with that id. Use search_notes or list_notes to find it.");
  return note;
}

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;

function withoutTitleHeading(noteId: number, content: string) {
  const title = savedNoteTitle(noteId)?.trim().toLowerCase();
  const lines = content.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  const heading = first === -1 ? null : HEADING.exec(lines[first].trim());
  if (!title || heading?.[1].trim().toLowerCase() !== title) return content;
  return lines
    .slice(first + 1)
    .join("\n")
    .replace(/^\s*\n/, "");
}

const cleaned = (noteId: number, content: string, mode: WriteMode) =>
  mode === "replace" ? withoutTitleHeading(noteId, content) : content;

function compose(base: string, content: string, mode: WriteMode) {
  if (mode === "replace") return content;
  const kept = base.trimEnd();
  return kept ? `${kept}\n\n${content.trimStart()}` : content;
}

function previewWrite(mode: WriteMode) {
  return (callId: string, args: ToolArgs) => {
    const note = findNote(noteIdOf(args));
    const content = stringArg(args, "content");
    if (!note || content === null || isDrawing(note.format)) return;
    let preview = previews.get(callId);
    if (!preview) {
      preview = { noteId: note.id, base: readNoteBody(note.id) };
      previews.set(callId, preview);
      startAiWriting(note.id);
    }
    const current = preview;
    current.base.then(
      (base) => {
        if (previews.get(callId) === current)
          showNoteBody(note.id, compose(base, cleaned(note.id, content, mode), mode));
      },
      () => undefined,
    );
  };
}

function discardWrite(callId: string) {
  const preview = previews.get(callId);
  if (!preview) return;
  previews.delete(callId);
  stopAiWriting(preview.noteId);
  void reportAction(readNoteBody(preview.noteId).then((body) => showNoteBody(preview.noteId, body)));
}

async function withAiWriting<T>(noteId: number, write: () => Promise<T>): Promise<T> {
  startAiWriting(noteId);
  try {
    const written = await write();
    await saveDrafts();
    return written;
  } finally {
    finishAiWriting(noteId);
  }
}

function commitWrite(callId: string, noteId: number, written: string, mode: WriteMode) {
  const content = cleaned(noteId, written, mode);
  previews.delete(callId);
  return withAiWriting(noteId, async () => {
    const body = compose(await readNoteBody(noteId), content, mode);
    writeNoteBody(noteId, body);
    return body;
  });
}

function describeHit(entries: Entry[], hit: SearchHit) {
  const folder = hit.parentId === null ? null : findEntry(entries, { kind: "folder", id: hit.parentId });
  const place = folder ? ` in folder “${folder.name}”` : "";
  return `- “${hit.title}” (note id ${hit.id}${drawingTag(hit.format)})${place}: ${hit.snippet}`;
}

function listing(entries: Entry[]): string {
  const rows = visibleRows(entries.map((entry) => (entry.kind === "folder" ? { ...entry, collapsed: false } : entry)));
  const lines = rows.slice(0, MAX_LISTED).map(({ entry, depth }) => {
    const indent = "  ".repeat(depth);
    if (entry.kind === "folder") return `${indent}- Folder “${entry.name}” (folder id ${entry.id})`;
    if (entry.kind === "note") return `${indent}- “${entry.title}” (note id ${entry.id}${drawingTag(entry.format)})`;
    return `${indent}- File “${entry.name}” (${entry.mediaType}, file id ${entry.id})`;
  });
  if (rows.length > MAX_LISTED) lines.push(`…and ${rows.length - MAX_LISTED} more.`);
  return lines.length > 0 ? lines.join("\n") : "There are no notes yet.";
}

const searchTool: AgentTool = {
  name: "search_notes",
  description:
    "Search the user's notes by words in their titles and text. Returns matching notes with ids and snippets.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Words to look for." } },
    required: ["query"],
  },
  edits: false,
  verbs: { running: "Searching notes", done: "Searched notes" },
  noun: null,
  icon: FileSearch,
  label: (args, verb) => {
    const query = stringArg(args, "query");
    return query ? `${verb} for “${query}”` : verb;
  },
  run: async (args) => {
    const query = requiredString(args, "query");
    const hits = await searchNotes(query, SEARCH_RESULTS);
    if (hits.length === 0) return { result: `No notes match “${query}”.` };
    const entries = getEntries();
    return { result: hits.map((hit) => describeHit(entries, hit)).join("\n") };
  },
};

const listTool: AgentTool = {
  name: "list_notes",
  description: "List all folders and notes with their ids, in the order they appear in the sidebar.",
  parameters: { type: "object", properties: {} },
  edits: false,
  verbs: { running: "Listing notes", done: "Listed notes" },
  noun: null,
  icon: FolderTree,
  run: async () => ({ result: listing(getEntries()) }),
};

const readTool: AgentTool = {
  name: "read_note",
  description:
    "Read a note by its id. Markdown notes return text; Excalidraw drawings return visible labels, shapes, layout, groups and connector relationships. Images and freehand strokes are not visually interpreted.",
  parameters: { type: "object", properties: { note_id: NOTE_ID }, required: ["note_id"] },
  edits: false,
  verbs: { running: "Reading", done: "Read" },
  noun: "note",
  icon: FileText,
  label: (args, verb) => `${verb} ${quoted(noteIdOf(args))}`,
  noteId: noteIdOf,
  run: async (args) => {
    const note = existingNote(args);
    showAiReading(note.id);
    const text = clipped(await bodyForAi(note));
    return { result: `Title: ${note.title}\n\n${text || "(The note is empty.)"}`, noteId: note.id };
  },
};

const clipped = (text: string) =>
  text.length > MAX_READ_CHARS ? `${text.slice(0, MAX_READ_CHARS)}\n\n[Cut off here.]` : text;

function imageSummary({ image: { width, height }, scale }: DrawingImage) {
  const size = `The rendered drawing is attached as a ${width} by ${height} pixel image in the next message.`;
  if (scale >= 1) return size;
  return `${size} It was shrunk to ${Math.round(scale * 100)}% of the drawing's size, so small details may be hard to read.`;
}

const viewTool: AgentTool = {
  name: "view_drawing",
  description:
    "Look at an Excalidraw drawing as a rendered image, including handwriting, freehand sketches and embedded pictures, together with its labels and connections. Use it when the answer depends on how the drawing looks.",
  parameters: { type: "object", properties: { note_id: NOTE_ID }, required: ["note_id"] },
  edits: false,
  vision: true,
  verbs: { running: "Looking at", done: "Looked at" },
  noun: "drawing",
  icon: Eye,
  label: (args, verb) => `${verb} ${quoted(noteIdOf(args))}`,
  noteId: noteIdOf,
  run: async (args) => {
    const { id, title } = noteOfFormat(args, "excalidraw");
    showAiReading(id);
    const body = await readNoteBody(id);
    const rendered = await drawingImage(body);
    const heading = `Title: ${title}`;
    if (!rendered) return { result: `${heading}\n\nThe drawing is empty, so there is nothing to look at.`, noteId: id };
    const structure = clipped(drawingContext(body, { withImage: true }));
    return { result: `${heading}\n\n${imageSummary(rendered)}\n\n${structure}`, noteId: id, image: rendered.image };
  },
};

const createTool: AgentTool = {
  name: "create_note",
  description: "Create a new note with a title and Markdown content, and open it.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "A short title. Don't repeat it as a heading in the content." },
      content: { type: "string", description: "The note body in Markdown." },
      folder_id: { type: "integer", description: "Optional folder id to put the note in." },
    },
    required: ["title", "content"],
  },
  edits: true,
  verbs: { running: "Creating", done: "Created" },
  noun: "note",
  icon: FilePlus,
  label: (args, verb) => {
    const title = stringArg(args, "title");
    return title ? `${verb} “${title}”` : `${verb} a note`;
  },
  run: async (args, callId) => {
    const title = requiredString(args, "title").trim() || null;
    const content = stringArg(args, "content") ?? "";
    const folderId = idArg(args, "folder_id");
    const parent = folderId !== null && findEntry(getEntries(), { kind: "folder", id: folderId }) ? folderId : null;
    const note = await createListedNote({ parentId: parent, title, show: openInNewTab });
    await commitWrite(callId, note.id, content, "replace");
    return {
      result: `Created the note “${note.title}” (note id ${note.id}).`,
      noteId: note.id,
      change: { kind: "created", noteId: note.id },
    };
  },
};

const WRITE_VERBS: Record<WriteMode, ToolVerbs> = {
  replace: { running: "Writing", done: "Wrote" },
  append: { running: "Adding to", done: "Added to" },
};

function writeTool(name: string, mode: WriteMode, description: string): AgentTool {
  return {
    name,
    description,
    parameters: {
      type: "object",
      properties: {
        note_id: NOTE_ID,
        content: {
          type: "string",
          description: mode === "replace" ? "The complete new note body in Markdown." : "Markdown to add at the end.",
        },
      },
      required: ["note_id", "content"],
    },
    edits: true,
    verbs: WRITE_VERBS[mode],
    noun: "note",
    icon: FilePen,
    label: (args, verb) => `${verb} ${quoted(noteIdOf(args))}`,
    noteId: noteIdOf,
    preview: previewWrite(mode),
    discard: discardWrite,
    run: async (args, callId) => {
      const note = noteOfFormat(args, "markdown");
      const change = await snapshot(note);
      const body = await commitWrite(callId, note.id, requiredString(args, "content"), mode);
      return { result: `Saved ${quoted(note.id)} (${body.length} characters).`, noteId: note.id, change };
    },
  };
}

const replaceTool: AgentTool = {
  name: "replace_in_note",
  description:
    "Replace an exact piece of text in a Markdown note. The text to find must match the note exactly. Cannot edit Excalidraw drawings.",
  parameters: {
    type: "object",
    properties: {
      note_id: NOTE_ID,
      find: { type: "string", description: "The exact text to replace, copied from the note." },
      replace: { type: "string", description: "The new text." },
    },
    required: ["note_id", "find", "replace"],
  },
  edits: true,
  verbs: { running: "Editing", done: "Edited" },
  noun: "note",
  icon: TextCursorInput,
  label: (args, verb) => `${verb} ${quoted(noteIdOf(args))}`,
  noteId: noteIdOf,
  run: async (args) => {
    const note = noteOfFormat(args, "markdown");
    const find = requiredString(args, "find");
    const replacement = stringArg(args, "replace") ?? "";
    const change = await snapshot(note);
    const { body } = change.before;
    if (!find || !body.includes(find)) {
      throw new Error("That text isn't in the note. Read the note and copy the exact text to replace.");
    }
    await withAiWriting(note.id, async () => writeNoteBody(note.id, body.replace(find, replacement)));
    return { result: `Edited ${quoted(note.id)}.`, noteId: note.id, change };
  },
};

const renameTool: AgentTool = {
  name: "rename_note",
  description: "Change a note's title.",
  parameters: {
    type: "object",
    properties: { note_id: NOTE_ID, title: { type: "string", description: "The new title." } },
    required: ["note_id", "title"],
  },
  edits: true,
  verbs: { running: "Renaming", done: "Renamed" },
  noun: "note",
  icon: TextCursorInput,
  label: (args, verb) => {
    const title = stringArg(args, "title");
    return title ? `${verb} to “${title}”` : `${verb} a note`;
  },
  noteId: noteIdOf,
  run: async (args) => {
    const note = existingNote(args);
    const change = await snapshot(note);
    const renamed = await renameEntry(note, requiredString(args, "title"));
    return { result: `Renamed the note to “${renamed ?? note.title}”.`, noteId: note.id, change };
  },
};

export const NOTE_TOOLS: AgentTool[] = [
  searchTool,
  listTool,
  readTool,
  viewTool,
  createTool,
  writeTool(
    "write_note",
    "replace",
    "Replace the whole body of a Markdown note. Read the note first so you keep what matters. Cannot edit Excalidraw drawings.",
  ),
  writeTool(
    "append_to_note",
    "append",
    "Add Markdown to the end of a Markdown note without changing the rest. Cannot edit Excalidraw drawings.",
  ),
  replaceTool,
  renameTool,
];

async function bodyForAi({ id, format }: NoteEntry): Promise<string> {
  const body = await readNoteBody(id);
  return isDrawing(format) ? drawingContext(body) : body;
}

export async function readNoteForAi(id: number): Promise<HostNote | null> {
  const note = findNote(id);
  return note ? { title: note.title, body: await bodyForAi(note) } : null;
}

export async function revertAiChanges(changes: NoteChange[]): Promise<void> {
  const reverted = firstChangePerNote(changes).filter(({ noteId }) => findNote(noteId) !== undefined);
  for (const change of reverted) {
    if (change.kind === "created") continue;
    const { noteId, before } = change;
    if (before.title && before.title !== savedNoteTitle(noteId))
      await renameEntry({ kind: "note", id: noteId }, before.title);
    writeNoteBody(noteId, before.body);
  }
  await saveDrafts();
  const created = reverted
    .filter((change) => change.kind === "created")
    .map(({ noteId }) => ({ kind: "note" as const, id: noteId }));
  if (created.length > 0) await moveToTrash(created);
}
