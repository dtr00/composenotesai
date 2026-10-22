import { ListChecks } from "lucide-react";
import { counted } from "../../../shared/lib/plural";
import { MAX_QUESTIONS, parseQuiz } from "../lib/quiz";
import { stringArg } from "../lib/tool-args";
import type { AgentTool } from "./agent-tools";

export const QUIZ_TOOL = "create_quiz";

export const quizTool: AgentTool = {
  name: QUIZ_TOOL,
  description: `Show the user an interactive quiz in the chat. They open it, answer the questions and submit, and then you grade it. Write the questions only from the notes the user wants to be quizzed on, never from the web or your own knowledge. Read those notes first. Mix multiple choice and short answer questions unless the user asks for one kind. At most ${MAX_QUESTIONS} questions.`,
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "A short quiz title, for example the note's subject." },
      questions: {
        type: "array",
        description: "The questions, in the order to ask them.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["choice", "short"],
              description: "choice for multiple choice, short for a typed answer.",
            },
            question: { type: "string", description: "The question text. Markdown and LaTeX are allowed." },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Choice questions only: 2 to 6 options.",
            },
            answer: {
              type: "string",
              description: "The correct answer. For choice questions, the exact text of the correct option.",
            },
          },
          required: ["type", "question", "answer"],
        },
      },
    },
    required: ["title", "questions"],
  },
  edits: false,
  verbs: { running: "Writing a quiz", done: "Wrote a quiz" },
  noun: null,
  icon: ListChecks,
  label: (args, verb) => {
    const title = stringArg(args, "title");
    return title ? `${verb}: ${title}` : verb;
  },
  run: async (args) => {
    const quiz = parseQuiz(args);
    return {
      result: `The quiz "${quiz.title}" with ${counted(quiz.questions.length, "question")} is now shown in the chat. The user will open it and submit their answers in a later message. Don't repeat the questions or the answers. Reply with one or two short sentences saying which notes it covers and that it's ready.`,
    };
  },
};
