import { Channel } from "@tauri-apps/api/core";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startSettings } from "../src/entities/settings/model/settings-store";
import { isRecord } from "../src/shared/lib/is-record";
import { setChatHost } from "../src/features/ai-chat/model/chat-host";
import { newChat, sendMessage, setDraft } from "../src/features/ai-chat/model/chat-store";
import { refreshModels } from "../src/features/ai-chat/model/models-store";
import { ChatComposer } from "../src/features/ai-chat/ui/chat-composer";
import { ChatThread } from "../src/features/ai-chat/ui/chat-thread";
import { checker, testSettings, waitFor } from "./browser-kit";

const quiz = {
  title: "Cells",
  questions: [
    {
      type: "choice",
      question: "Which organelle makes energy?",
      options: ["Nucleus", "Mitochondria"],
      answer: "Mitochondria",
    },
    { type: "short", question: "What does DNA stand for?", answer: "Deoxyribonucleic acid" },
  ],
};

interface RequestMessage {
  role: string;
  content: string;
}

const byText = (selector: string, text: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.trim() === text);

export async function testQuizChat() {
  const { passed, check } = checker();
  const requests: { system: string; text: string }[] = [];
  startSettings(testSettings({ theme: "dark" }));
  mockWindows("main");
  mockIPC(
    (command, payload) => {
      if (command === "list_skills") return [];
      if (command === "list_chats") return [];
      if (command === "save_chat") return 1;
      if (command === "list_entries") return [];
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
      if (command !== "ai_chat") return;
      if (!isRecord(payload?.request) || !(payload.onEvent instanceof Channel)) throw new Error("Invalid request");
      const messages = payload.request.messages as RequestMessage[];
      requests.push({ system: messages[0].content, text: messages.map((message) => message.content).join("\n---\n") });
      const emit = payload.onEvent.onmessage;
      const last = messages[messages.length - 1];
      if (last.role === "user" && last.content.includes("Answer key"))
        emit({ type: "text", delta: "You scored 1 of 2." });
      else if (last.role === "user")
        emit({ type: "toolCall", index: 0, id: "quiz-1", name: "create_quiz", arguments: JSON.stringify(quiz) });
      else emit({ type: "text", delta: "Your quiz on cells is ready." });
    },
    { shouldMockEvents: true },
  );
  setChatHost({
    tools: [],
    readNote: async () => null,
    revertNotes: async () => {},
    tabNoteIds: () => [],
    openLink: () => {},
  });
  const container = document.createElement("div");
  container.style.cssText = "width:420px;height:640px;display:flex;flex-direction:column";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await refreshModels();
    newChat();
    flushSync(() =>
      root.render(
        createElement(
          "div",
          { className: "flex h-full flex-col" },
          createElement(ChatThread),
          createElement(ChatComposer),
        ),
      ),
    );

    setDraft("/");
    await waitFor(() => document.querySelector('[aria-label="Commands"]') !== null);
    const picker = document.querySelector('[aria-label="Commands"]');
    check(picker?.textContent?.includes("/quizme") === true, "Typing a slash lists the /quizme command");
    check(picker?.textContent?.includes("Make a quiz from your notes") === true, "The command shows its description");
    setDraft("/zzz");
    await waitFor(() => document.querySelector('[aria-label="Commands"]') === null);
    check(true, "The command list hides when nothing matches");
    setDraft("");

    await sendMessage("/quizme the cells note");
    await waitFor(() => byText("button", "Open quiz") !== undefined);
    await new Promise((resolve) => setTimeout(resolve, 300));
    check(requests[0].system.includes("## Command: /quizme"), "Sending /quizme adds the command instructions");
    check(requests[0].system.includes("Do not use web_search"), "The command tells the model to trust the notes");
    check(document.body.textContent?.includes("Quiz · 2 questions") === true, "The quiz shows in the chat as a card");
    check(!document.body.textContent?.includes("Deoxyribonucleic"), "The answer key is not shown in the chat");

    byText("button", "Open quiz")?.click();
    await waitFor(() => document.querySelector('[role="dialog"]') !== null);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error("Quiz dialog missing");
    check(dialog.textContent?.includes("Which organelle makes energy?") === true, "The dialog lists the questions");
    check(!dialog.textContent?.includes("Deoxyribonucleic"), "The dialog does not reveal answers");
    const submit = byText("button", "Submit answers");
    check(submit instanceof HTMLButtonElement && submit.disabled, "Submit stays disabled until a question is answered");

    const radios = dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    check(radios.length === 2, "Multiple choice questions show their options");
    radios[0].click();
    const box = dialog.querySelector<HTMLTextAreaElement>("textarea");
    if (!box) throw new Error("Short answer box missing");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, "Dioxy nucleic acid");
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      const button = byText("button", "Submit answers");
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    byText("button", "Submit answers")?.click();

    await waitFor(() => document.body.textContent?.includes("You scored 1 of 2.") === true);
    const graded = requests[requests.length - 1].text;
    check(
      graded.includes("Answer key: Mitochondria\nUser's answer: Nucleus"),
      "Submitted choices reach the model with the key",
    );
    check(graded.includes("User's answer: Dioxy nucleic acid"), "Submitted typed answers reach the model");
    check(document.querySelector('[role="dialog"]') === null, "The dialog closes after submitting");
    check(byText("button", "Retake quiz") !== undefined, "The card offers a retake after submitting");
    check(document.body.textContent?.includes("Submitted") === true, "The card shows the quiz was submitted");
  } finally {
    root.unmount();
    container.remove();
    clearMocks();
  }
  return passed;
}
