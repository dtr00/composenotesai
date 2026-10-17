import { drawingTag, isDrawing } from "../../../entities/note/lib/note-format";
import type { SkillSummary } from "../../../shared/api/skills";
import type { NoteSummary } from "../../../shared/api/notes";
import agentFile from "../config/compose-agent.md?raw";

export const DEFAULT_AGENT_INSTRUCTIONS = agentFile.trim();

export type NoteTitle = Pick<NoteSummary, "id" | "title" | "format">;

export interface LoadedSkill {
  name: string;
  body: string;
}

interface PromptContext {
  instructions: string | null;
  skills: SkillSummary[];
  loadedSkills: LoadedSkill[];
  notes: NoteTitle[];
  openNote: NoteTitle | null;
  tabNotes: NoteTitle[];
  allowEdits: boolean;
  web: "online" | "offline" | "off";
  vision: boolean;
  now: Date;
}

const LISTED_NOTES = 40;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function skillsSection(skills: SkillSummary[]): string | null {
  const enabled = skills.filter((skill) => skill.enabled);
  if (enabled.length === 0) return null;
  const list = enabled.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
  return `## Installed skills\n\nWhen a request matches one of these, call read_skill with its name before you answer, then follow it.\n\n${list}`;
}

const quoted = (notes: NoteTitle[]) =>
  notes.map((note) => `"${note.title}" (id ${note.id}${drawingTag(note.format)})`).join(", ");

function notesLine(notes: NoteTitle[]): string {
  if (notes.length === 0) return "- There are no notes yet.";
  const listed = quoted(notes.slice(0, LISTED_NOTES));
  const more = notes.length > LISTED_NOTES ? `, and ${notes.length - LISTED_NOTES} more` : "";
  return `- The user has ${notes.length} notes: ${listed}${more}.`;
}

const WEB_LINES = {
  online: "- You're online, so you can search the web, read pages and find images.",
  offline: "- You're offline right now, so you can't search the web. Say so if the user asks you to.",
  off: "- Web search is turned off, so you can't look things up online. If the user asks you to, say they can turn it on with the globe button next to the model name.",
};

const DRAWING_LINES = {
  vision:
    "- Read Excalidraw drawings with read_note for their labels, layout and connections. When the answer depends on how a drawing looks, such as handwriting, freehand sketches or embedded pictures, call view_drawing to see it. Say when something in the image is hard to make out. Markdown writing tools cannot edit drawings.",
  text: "- Read Excalidraw drawings with read_note to understand their labels, layout and connections. This model can't see images, so handwriting, freehand strokes and embedded pictures are not visible to you. If a question depends on them, say so and suggest a model that can see images, from [AI settings](settings:ai). Markdown writing tools cannot edit drawings.",
};

function situation({ notes, openNote, tabNotes, allowEdits, web, vision, now }: PromptContext): string {
  const lines = [`- Today is ${dateFormat.format(now)}.`, notesLine(notes)];
  lines.push(
    openNote
      ? `- The user is looking at ${isDrawing(openNote.format) ? "the Excalidraw drawing" : "the note"} "${openNote.title}" (note id ${openNote.id}).`
      : "- The user doesn't have a note open.",
  );
  if (tabNotes.length > 0) lines.push(`- Also open in tabs: ${quoted(tabNotes)}.`);
  if (notes.some((note) => isDrawing(note.format))) lines.push(DRAWING_LINES[vision ? "vision" : "text"]);
  if (!allowEdits) lines.push("- Note editing is turned off. You can read and search notes but not change them.");
  lines.push(WEB_LINES[web]);
  return `## Right now\n\n${lines.join("\n")}`;
}

function loadedSection(skills: LoadedSkill[]): string | null {
  if (skills.length === 0) return null;
  const bodies = skills.map((skill) => `### ${skill.name}\n\n${skill.body}`).join("\n\n");
  return `## Skills for this request\n\nThese skills match the request. Follow them. You don't need to read them again.\n\n${bodies}`;
}

export function systemPrompt(context: PromptContext): string {
  const instructions = context.instructions?.trim() || DEFAULT_AGENT_INSTRUCTIONS;
  return [instructions, skillsSection(context.skills), loadedSection(context.loadedSkills), situation(context)]
    .filter(Boolean)
    .join("\n\n");
}
