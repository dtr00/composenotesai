import assert from "node:assert/strict";
import { test } from "node:test";
import { isCompleteObject, jsonArguments, parsePartialObject } from "../src/features/ai-chat/lib/partial-json";
import { matchingSkills } from "../src/features/ai-chat/lib/skill-match";
import { appLink, mediaLinkId } from "../src/features/ai-chat/lib/app-links";
import { commandIn, typedCommands } from "../src/features/ai-chat/lib/chat-command";
import { parseQuiz, quizFromArguments, quizSubmission } from "../src/features/ai-chat/lib/quiz";
import { insertMention, matchingTitles, mentionAt } from "../src/features/ai-chat/lib/mention";
import { toolSummary, type ToolAction } from "../src/features/ai-chat/lib/tool-summary";
import { workedFor } from "../src/features/ai-chat/lib/work-time";
import { countChanges, noteChangesFrom } from "../src/features/ai-chat/lib/note-changes";
import { readSavedMessages } from "../src/features/ai-chat/lib/saved-chat";
import { linksIn, pageKey } from "../src/features/ai-chat/lib/web-links";
import { clipAttachment, toWire, withRecentImages, withSavedImages } from "../src/features/ai-chat/lib/wire";
import type { WireMessage } from "../src/shared/api/ai";
import type { ConversationMessage, NoteSnapshot, ToolPart } from "../src/features/ai-chat/model/conversation";

test("partial tool arguments parse while they stream", () => {
  assert.deepEqual(parsePartialObject('{"title":"Gro'), { title: "Gro" });
  assert.deepEqual(parsePartialObject('{"note_id": 12, "content": "- eggs\\n- mi'), {
    note_id: 12,
    content: "- eggs\n- mi",
  });
  assert.deepEqual(parsePartialObject('{"content": "cut \\'), { content: "cut " });
  assert.deepEqual(parsePartialObject('{"title"'), {});
  assert.deepEqual(parsePartialObject('{"a":"\\u00e9","b":[1,2'), { a: "é", b: [1, 2] });
  assert.deepEqual(parsePartialObject("[1, 2]"), {});
  assert.deepEqual(parsePartialObject(""), {});
});

test("conversations turn into model messages with tool calls and results", () => {
  const messages: ConversationMessage[] = [
    { id: "u1", role: "user", text: "Tidy this", attachments: [], sentAt: 0 },
    {
      id: "a1",
      role: "assistant",
      model: "Qwen",
      skills: [],
      status: null,
      error: null,
      stats: null,
      parts: [
        { kind: "reasoning", text: "plan" },
        { kind: "text", text: "Reading it." },
        {
          kind: "tool",
          id: "c1",
          name: "read_note",
          arguments: '{"note_id":3}',
          status: "done",
          label: "Read",
          result: "body",
          noteId: 3,
        },
        {
          kind: "tool",
          id: "c2",
          name: "write_note",
          arguments: "{}",
          status: "running",
          label: "Writing",
          result: null,
          noteId: null,
        },
        { kind: "text", text: "Done." },
      ],
    },
  ];
  assert.deepEqual(toWire(messages), [
    { role: "user", content: "Tidy this" },
    {
      role: "assistant",
      content: "Reading it.",
      toolCalls: [
        { id: "c1", name: "read_note", arguments: '{"note_id":3}' },
        { id: "c2", name: "write_note", arguments: "{}" },
      ],
    },
    { role: "tool", toolCallId: "c1", toolName: "read_note", content: "body" },
    { role: "tool", toolCallId: "c2", toolName: "write_note", content: "The user stopped this before it finished." },
    { role: "assistant", content: "Done.", toolCalls: [] },
  ]);
});

const viewed = (id: string, data: string): ToolPart => ({
  kind: "tool",
  id,
  name: "view_drawing",
  arguments: '{"note_id":4}',
  status: "done",
  label: "Looked at “Plan”",
  result: "Title: Plan",
  noteId: 4,
  image: { mimeType: "image/png", data, width: 800, height: 400 },
});

test("drawing images the AI saw follow their tool results as an app-attached message", () => {
  const wire = toWire([
    { id: "u1", role: "user", text: "What did I sketch?", attachments: [], sentAt: 0 },
    {
      id: "a1",
      role: "assistant",
      model: "Gemma",
      skills: [],
      status: null,
      error: null,
      stats: null,
      parts: [viewed("v1", "iVBOR"), { kind: "text", text: "A cat." }],
    },
  ]);
  assert.deepEqual(
    wire.map((message) => message.role),
    ["user", "assistant", "tool", "user", "assistant"],
  );
  assert.equal(wire[2].content, "Title: Plan");
  assert.ok(!wire[2].content.includes("iVBOR"));
  assert.deepEqual(wire[3], {
    role: "user",
    content: "The app attached the image returned by the view_drawing call v1. This was not typed by the user.",
    images: [{ mimeType: "image/png", data: "iVBOR" }],
  });
});

test("only the newest images are sent again, and only to models that see images", () => {
  const image = (data: string): WireMessage => ({
    role: "user",
    content: data,
    images: [{ mimeType: "image/png", data }],
  });
  const history = [image("one"), image("two"), image("three"), image("four"), image("five")];
  const counts = (messages: WireMessage[]) =>
    messages.map((message) => (message.role === "user" ? (message.images?.length ?? 0) : 0));
  const sent = withRecentImages(history, true);
  assert.deepEqual(counts(sent), [0, 1, 1, 1, 1]);
  assert.match(sent[0].content, /^one\n\n\(Images attached here earlier are left out/);
  assert.deepEqual(counts(withRecentImages(history, false)), [0, 0, 0, 0, 0]);
  const plain: WireMessage[] = [{ role: "user", content: "hi" }];
  assert.deepEqual(withRecentImages(plain, false), plain);
});

test("saved chats keep the images of only the newest drawing views", () => {
  const reply = (id: string, parts: ToolPart[]): ConversationMessage => ({
    id,
    role: "assistant",
    model: "Gemma",
    skills: [],
    status: null,
    error: null,
    stats: null,
    parts,
  });
  const messages = [
    reply("a", [viewed("v1", "one"), viewed("v2", "two")]),
    { id: "u", role: "user" as const, text: "again", attachments: [], sentAt: 0 },
    reply("b", [viewed("v3", "three"), viewed("v4", "four"), viewed("v5", "five")]),
  ];
  const kept = withSavedImages(messages).flatMap((message) =>
    message.role === "assistant" ? message.parts.map((part) => (part.kind === "tool" ? part.image?.data : null)) : [],
  );
  assert.deepEqual(kept, [undefined, "two", "three", "four", "five"]);
  assert.equal(JSON.stringify(withSavedImages(messages)).includes('"one"'), false);
});

test("skills load when every word of their name is in the request", () => {
  const skill = (name: string, enabled = true) => ({ id: 1, name, description: "", enabled, source: null, bytes: 0 });
  const skills = [skill("meeting-notes"), skill("study-guide"), skill("quiz", false)];
  const names = (message: string) => matchingSkills(message, skills).map((found) => found.name);
  assert.deepEqual(names("Clean up these meeting notes"), ["meeting-notes"]);
  assert.deepEqual(names("Make a study guide for my meetings"), ["study-guide"]);
  assert.deepEqual(names("quiz me"), []);
  assert.deepEqual(names("notes from the meeting"), ["meeting-notes"]);
});

test("app links point at notes, folders, files and settings pages", () => {
  assert.deepEqual(appLink("note:12"), { kind: "entry", ref: { kind: "note", id: 12 } });
  assert.deepEqual(appLink("folder:3"), { kind: "entry", ref: { kind: "folder", id: 3 } });
  assert.deepEqual(appLink("file:7"), { kind: "entry", ref: { kind: "media", id: 7 } });
  assert.deepEqual(appLink("settings:ai/skills"), { kind: "page", path: "/settings/ai/skills" });
  assert.deepEqual(appLink("settings:general"), { kind: "page", path: "/settings" });
  assert.deepEqual(appLink("#/notes/4"), { kind: "entry", ref: { kind: "note", id: 4 } });
  assert.equal(appLink("https://example.com"), null);
  assert.equal(mediaLinkId("image:5"), 5);
  assert.equal(mediaLinkId("https://example.com/a.png"), null);
});

test("tool runs are summed up by what they did", () => {
  const search = { verb: "Searched notes", noun: null };
  const read = { verb: "Read", noun: "note" };
  const edit = { verb: "Edited", noun: "note" };
  const call = (action: ToolAction | undefined, noteId: number | null = null) => ({ action, noteId });
  assert.equal(
    toolSummary([call(search), call(read, 1), call(read, 2), call(edit, 1)]),
    "Searched notes, read 2 notes and edited a note",
  );
  assert.equal(toolSummary([call(edit, 3), call(edit, 3)]), "Edited a note");
  assert.equal(toolSummary([call(undefined), call(undefined)]), "Used 2 tools");
});

test("@ mentions notes and # mentions folders", () => {
  const notes = [{ title: "Weekly plan" }, { title: "Plan for trip" }, { title: "Shopping" }];
  const text = "compare @pla";
  const mention = mentionAt(text, text.length);
  assert.deepEqual(mention, { trigger: "@", from: 8, query: "pla" });
  assert.deepEqual(
    matchingTitles(notes, "pla").map((note) => note.title),
    ["Plan for trip", "Weekly plan"],
  );
  assert.equal(insertMention(text, mention!, text.length, "Weekly plan"), "compare @Weekly plan ");
  assert.deepEqual(mentionAt("sum up #wor", 11), { trigger: "#", from: 7, query: "wor" });
  assert.deepEqual(mentionAt("@Weekly plan and #Wo", 20), { trigger: "#", from: 17, query: "Wo" });
  assert.deepEqual(mentionAt("#", 1), { trigger: "#", from: 0, query: "" });
  assert.equal(mentionAt("email me@work", 13), null);
  assert.equal(mentionAt("# Heading", 9), null);
  assert.equal(mentionAt("issue#12", 8), null);
});

test("attachments go before the message", () => {
  const messages: ConversationMessage[] = [
    {
      id: "u1",
      role: "user",
      text: "Sum these up",
      attachments: [
        { kind: "note", name: 'My "plan"', id: 4, content: "- a" },
        { kind: "folder", name: "Work", id: 2, content: "## Plan (note id 4)" },
        { kind: "file", name: "data.csv", content: "" },
      ],
      sentAt: 0,
    },
  ];
  assert.deepEqual(toWire(messages), [
    {
      role: "user",
      content: `<note id="4" name="My 'plan'">\n- a\n</note>\n\n<folder id="2" name="Work">\n## Plan (note id 4)\n</folder>\n\n<file name="data.csv">\n(empty)\n</file>\n\nSum these up`,
    },
  ]);
  assert.match(clipAttachment("x".repeat(20_001)), /Cut off here/);
});

test("agent work is labelled by how long it took", () => {
  assert.equal(workedFor(200), "Worked for 1s");
  assert.equal(workedFor(12_400), "Worked for 12s");
  assert.equal(workedFor(60_000), "Worked for 1m");
  assert.equal(workedFor(65_200), "Worked for 1m 5s");
});

test("cut-off tool calls are caught and sent back as valid JSON", () => {
  const cut = '{"note_id": 3, "content": "# Fibonacci\\n\\n## 2. Recursive Approach (';
  assert.equal(isCompleteObject(cut), false);
  assert.equal(isCompleteObject('{"note_id": 3}'), true);
  assert.equal(isCompleteObject(""), true);
  assert.equal(isCompleteObject("[1]"), false);
  assert.deepEqual(JSON.parse(jsonArguments(cut)), {
    note_id: 3,
    content: "# Fibonacci\n\n## 2. Recursive Approach (",
  });
  assert.equal(jsonArguments('{"a":1}'), '{"a":1}');
  assert.equal(jsonArguments(""), "{}");
  const wire = toWire([
    {
      id: "a1",
      role: "assistant",
      model: "m",
      skills: [],
      status: null,
      error: null,
      stats: null,
      parts: [
        {
          kind: "tool",
          id: "c1",
          name: "write_note",
          arguments: cut,
          status: "stopped",
          label: "",
          result: null,
          noteId: 3,
        },
      ],
    },
  ]);
  const [assistant] = wire;
  assert.ok(assistant.role === "assistant");
  assert.doesNotThrow(() => JSON.parse(assistant.toolCalls[0].arguments));
});

test("reverting collects the AI's finished note changes from a message on", () => {
  const tool = (id: string, status: "done" | "failed", noteId: number, before: NoteSnapshot | null) => ({
    kind: "tool" as const,
    id,
    name: "write_note",
    arguments: "{}",
    status,
    label: "",
    result: "",
    noteId,
    change: before ? { kind: "edited" as const, noteId, before } : { kind: "created" as const, noteId },
  });
  const reply = (id: string, parts: ReturnType<typeof tool>[]): ConversationMessage => ({
    id,
    role: "assistant",
    model: "m",
    skills: [],
    status: null,
    error: null,
    stats: null,
    parts,
  });
  const messages: ConversationMessage[] = [
    { id: "u1", role: "user", text: "make a note", attachments: [], sentAt: 0 },
    reply("a1", [tool("c1", "done", 9, null)]),
    { id: "u2", role: "user", text: "edit it", attachments: [], sentAt: 0 },
    reply("a2", [
      tool("c2", "done", 9, { title: "A", body: "one" }),
      tool("c3", "failed", 4, { title: "B", body: "" }),
    ]),
    reply("a3", [tool("c4", "done", 4, { title: "B", body: "two" })]),
  ];
  assert.deepEqual(
    noteChangesFrom(messages, 2).map((change) => change.noteId),
    [9, 4],
  );
  assert.deepEqual(countChanges(noteChangesFrom(messages, 0)), { notes: 2, created: 1 });
  assert.deepEqual(countChanges(noteChangesFrom(messages, 2)), { notes: 2, created: 0 });
  assert.equal(noteChangesFrom(messages, 0)[0].kind, "created");
});

test("saved chats keep only well-formed messages", () => {
  const user = { id: "u1", role: "user", text: "hi", attachments: [], sentAt: 0 };
  const reply = {
    id: "a1",
    role: "assistant",
    model: "m",
    skills: [],
    status: null,
    error: null,
    stats: null,
    parts: [],
  };
  assert.deepEqual(readSavedMessages([user, { id: "x", role: "system" }, null, reply]), [user, reply]);
  assert.deepEqual(readSavedMessages({ messages: [user] }), []);
});

test("links are found and compared by page", () => {
  assert.deepEqual(linksIn("See https://tauri.app/. And (https://example.com/a#intro), not ftp://x.org"), [
    "https://tauri.app",
    "https://example.com/a",
  ]);
  assert.equal(pageKey("https://example.com/a/#part"), pageKey("https://example.com/a"));
  assert.equal(pageKey("javascript:alert(1)"), null);
  assert.equal(pageKey("not a link"), null);
});

test("quizzes are checked before they are shown", () => {
  const args = {
    title: "Cells",
    questions: [
      { type: "choice", question: "Powerhouse?", options: ["Nucleus", "Mitochondria"], answer: "mitochondria" },
      { type: "short", question: "What is DNA?", answer: "Genetic material" },
    ],
  };
  const quiz = parseQuiz(args);
  assert.equal(quiz.questions.length, 2);
  assert.deepEqual(quiz.questions[0], {
    kind: "choice",
    prompt: "Powerhouse?",
    options: ["Nucleus", "Mitochondria"],
    answer: "Mitochondria",
  });
  assert.throws(() => parseQuiz({ ...args, questions: [] }));
  assert.throws(() =>
    parseQuiz({ title: "x", questions: [{ type: "choice", question: "q", options: ["a", "b"], answer: "c" }] }),
  );
  assert.throws(() => parseQuiz({ title: "x", questions: [{ type: "short", question: "q" }] }));
  assert.equal(quizFromArguments('{"title":"Cells","questions":[{"type":"short","question":"q"'), null);
  const text = quizSubmission(quiz, ["Nucleus", ""]);
  assert.match(text, /Answer key: Mitochondria\nUser's answer: Nucleus/);
  assert.match(text, /User's answer: \(no answer\)/);
});

test("slash commands are suggested while typing and found when sent", () => {
  const commands = [{ name: "quizme", description: "", instructions: "" }];
  assert.equal(typedCommands("/", commands).length, 1);
  assert.equal(typedCommands("/qu", commands).length, 1);
  assert.equal(typedCommands("/x", commands).length, 0);
  assert.equal(typedCommands("/quizme ", commands).length, 0);
  assert.equal(typedCommands("hello /qu", commands).length, 0);
  assert.equal(commandIn("/quizme @Biology", commands)?.name, "quizme");
  assert.equal(commandIn("/QuizMe", commands)?.name, "quizme");
  assert.equal(commandIn("/quizmenow", commands), null);
  assert.equal(commandIn("quiz me", commands), null);
});
