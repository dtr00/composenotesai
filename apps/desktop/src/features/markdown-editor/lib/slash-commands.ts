import {
  closeCompletion,
  completionStatus,
  currentCompletions,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSection,
} from "@codemirror/autocomplete";
import { Prec, StateEffect, StateField, type EditorState, type Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { EMBED_URL_PLACEHOLDER, linkEmbedMarkdown } from "./link-embed-markdown";
import { BLOCK_FORMATS, INLINE_ACTIONS, INLINE_FORMATS, type BlockAction, type InlineAction } from "./editor-formats";
import { splitBlockMarkup } from "./line-blocks";
import { insideCode } from "./markdown-syntax";
import { slashHint } from "./slash-hint";
import { firstCell, focusTable } from "./table-widgets";

type Apply = (view: EditorView, from: number, to: number) => void;

interface SlashCommand {
  label: string;
  hint: string;
  keywords: string[];
  section: CompletionSection;
  apply: Apply;
}

interface LinePart {
  text: string;
  cursor: number;
  selected: number;
}

const MAX_QUERY_LENGTH = 24;
const BLOCKS: CompletionSection = { name: "Blocks", rank: 0 };
const INLINE: CompletionSection = { name: "Inline", rank: 1 };

const dismissSlash = StateEffect.define<null>();

function typedSlash(tr: Transaction): number | null {
  if (!tr.isUserEvent("input.type")) return null;
  let slash: number | null = null;
  tr.changes.iterChanges((fromA, _toA, _fromB, toB, inserted) => {
    const at = toB - 1;
    const before = tr.newDoc.sliceString(Math.max(0, at - 1), at);
    const typed = inserted.toString().trimStart() === "/";
    if (typed && !/\S/.test(before) && !insideCode(tr.startState, fromA)) slash = at;
  });
  return slash;
}

function queryAt(state: EditorState, slash: number): string | null {
  const { head, empty } = state.selection.main;
  if (!empty || head <= slash || state.sliceDoc(slash, slash + 1) !== "/") return null;
  const query = state.sliceDoc(slash + 1, head);
  return query.length <= MAX_QUERY_LENGTH && !query.includes("\n") ? query : null;
}

const slashField = StateField.define<number | null>({
  create: () => null,
  update(slash, tr) {
    if (tr.effects.some((effect) => effect.is(dismissSlash))) return null;
    const next = typedSlash(tr) ?? (slash === null ? null : tr.changes.mapPos(slash));
    return next !== null && queryAt(tr.state, next) !== null ? next : null;
  },
});

function lineWithoutQuery(view: EditorView, from: number, to: number) {
  const line = view.state.doc.lineAt(from);
  const text = line.text.slice(0, from - line.from) + line.text.slice(to - line.from);
  return { line, text, at: from - line.from };
}

const setBlock =
  (prefix: string): Apply =>
  (view, from, to) => {
    const { line, text, at } = lineWithoutQuery(view, from, to);
    const { indent, markup, body } = splitBlockMarkup(text);
    const cursor = indent.length + prefix.length + Math.max(0, at - indent.length - markup.length);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent + prefix + body },
      selection: { anchor: line.from + cursor },
      userEvent: "input.complete",
    });
  };

const insertBlock =
  (before: LinePart[], after: string[] = []): Apply =>
  (view, from, to) => {
    const { line, text } = lineWithoutQuery(view, from, to);
    const { doc } = view.state;
    const next = line.number < doc.lines ? doc.line(line.number + 1).text : "";
    const previous = line.number > 1 ? doc.line(line.number - 1).text : "";
    const blank = splitBlockMarkup(text).body.trim() === "";
    const lead = blank ? (previous.trim() === "" ? "" : "\n") : `${text}\n\n`;
    const head = lead + before.map((part) => part.text).join("\n");
    const tail = [...after, ...(next.trim() === "" ? [] : [""])].map((text) => `\n${text}`).join("");
    const last = before[before.length - 1];
    const anchor = line.from + head.length - last.text.length + last.cursor;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: head + tail },
      selection: { anchor, head: anchor + last.selected },
      userEvent: "input.complete",
    });
  };

const at = (text: string, cursor = text.length, selected = 0): LinePart => ({ text, cursor, selected });

const heading = (level: number): SlashCommand => ({
  label: `Heading ${level}`,
  hint: "#".repeat(level),
  keywords: [`h${level}`, "title"],
  section: BLOCKS,
  apply: setBlock(`${"#".repeat(level)} `),
});

function formatBlock(action: BlockAction): SlashCommand {
  const { label, hint, keywords, prefix } = BLOCK_FORMATS[action];
  return { label, hint, keywords, section: BLOCKS, apply: setBlock(prefix(0)) };
}

function formatInline(action: InlineAction): SlashCommand {
  const { label, hint, keywords, run } = INLINE_FORMATS[action];
  return {
    label,
    hint,
    keywords,
    section: INLINE,
    apply: (view, from, to) => {
      view.dispatch({ changes: { from, to }, selection: { anchor: from }, userEvent: "input.complete" });
      run(view);
    },
  };
}

function blockCommands(): SlashCommand[] {
  return [
    formatBlock("text"),
    formatBlock("heading1"),
    formatBlock("heading2"),
    formatBlock("heading3"),
    heading(4),
    heading(5),
    heading(6),
    formatBlock("bulletedList"),
    formatBlock("numberedList"),
    formatBlock("todoList"),
    { label: "Quote", hint: ">", keywords: ["blockquote", "citation"], section: BLOCKS, apply: setBlock("> ") },
    {
      label: "Code block",
      hint: "```",
      keywords: ["fence", "snippet", "pre", "programming"],
      section: BLOCKS,
      apply: insertBlock([at("```"), at("")], ["```"]),
    },
    {
      label: "Table",
      hint: "| |",
      keywords: ["grid", "columns", "rows"],
      section: BLOCKS,
      apply: (view, from, to) => {
        insertBlock([at("| Column 1 | Column 2 |"), at("| --- | --- |"), at("|  |  |", 2)])(view, from, to);
        focusTable(view, view.state.selection.main.head, firstCell, "all");
      },
    },
    {
      label: "Divider",
      hint: "---",
      keywords: ["hr", "horizontal rule", "separator", "line"],
      section: BLOCKS,
      apply: insertBlock([at("---"), at("")]),
    },
  ];
}

const mediaCommand = (pickMedia: (view: EditorView) => void): SlashCommand => ({
  label: "Attachment",
  hint: "![ ]( )",
  keywords: [
    "media",
    "image",
    "picture",
    "photo",
    "video",
    "movie",
    "clip",
    "film",
    "recording",
    "document",
    "pdf",
    "docx",
    "word",
    "upload",
    "file",
    "embed",
  ],
  section: BLOCKS,
  apply: (view, from, to) => {
    view.dispatch({ changes: { from, to }, selection: { anchor: from }, userEvent: "input.complete" });
    pickMedia(view);
  },
});

const LINK_EMBED_TEMPLATE = linkEmbedMarkdown(EMBED_URL_PLACEHOLDER);
const LINK_EMBED_URL_AT = LINK_EMBED_TEMPLATE.indexOf(EMBED_URL_PLACEHOLDER);

const linkEmbedCommand: SlashCommand = {
  label: "Link embed",
  hint: "[ ]( )",
  keywords: ["bookmark", "website", "web", "url", "preview", "card", "embed"],
  section: BLOCKS,
  apply: insertBlock([at(LINK_EMBED_TEMPLATE, LINK_EMBED_URL_AT, EMBED_URL_PLACEHOLDER.length)]),
};

function slashCommandList(pickMedia: (view: EditorView) => void): SlashCommand[] {
  return [...blockCommands(), mediaCommand(pickMedia), linkEmbedCommand, ...INLINE_ACTIONS.map(formatInline)];
}

const queryWords = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

function matchesQuery(command: SlashCommand, query: string) {
  const haystack = [command.label, ...command.keywords].join(" ").toLowerCase();
  return queryWords(query).every((word) => haystack.includes(word));
}

const toCompletion = ({ label, hint, section, apply }: SlashCommand): Completion => ({
  label,
  detail: hint,
  section,
  apply: (view, _completion, from, to) => apply(view, from, to),
});

function slashSource(commands: SlashCommand[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const slash = context.state.field(slashField, false) ?? null;
    if (slash === null) return null;
    const query = context.state.sliceDoc(slash + 1, context.pos);
    const options = commands.filter((command) => matchesQuery(command, query)).map(toCompletion);
    return options.length > 0 ? { from: slash, to: context.pos, options, filter: false } : null;
  };
}

const dismissOnEscape = Prec.highest(
  keymap.of([
    {
      key: "Escape",
      run: (view) => {
        const slash = view.state.field(slashField, false) ?? null;
        if (completionStatus(view.state) === null || slash === null) return false;
        view.dispatch({ effects: dismissSlash.of(null) });
        return false;
      },
    },
  ]),
);

function acceptTypedCommand(commands: SlashCommand[]) {
  return (view: EditorView) => {
    const slash = view.state.field(slashField, false) ?? null;
    if (slash === null) return false;
    const head = view.state.selection.main.head;
    const query = view.state.sliceDoc(slash + 1, head);
    const matches = commands.filter((command) => matchesQuery(command, query));
    if (query.trim() === "" || matches.length === 0) return false;
    const shown = currentCompletions(view.state).map((completion) => completion.label);
    const menuIsCurrent =
      completionStatus(view.state) === "active" &&
      shown.length === matches.length &&
      matches.every((command, index) => command.label === shown[index]);
    if (menuIsCurrent) return false;
    closeCompletion(view);
    matches[0].apply(view, slash, head);
    return true;
  };
}

export function slashCommands(pickMedia: (view: EditorView) => void) {
  const commands = slashCommandList(pickMedia);
  const accept = acceptTypedCommand(commands);
  return {
    source: slashSource(commands),
    extension: [
      slashField,
      slashHint,
      dismissOnEscape,
      Prec.highest(
        keymap.of([
          { key: "Enter", run: accept },
          { key: "Tab", run: accept },
        ]),
      ),
    ],
  };
}
