import { isRecord } from "../../../shared/lib/is-record";
import { parsePartialObject } from "./partial-json";

export type QuizQuestion =
  | { kind: "choice"; prompt: string; options: string[]; answer: string }
  | { kind: "short"; prompt: string; answer: string };

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export const MAX_QUESTIONS = 15;
export const MAX_ANSWER_CHARS = 1000;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function question(raw: unknown, index: number): QuizQuestion {
  const where = `Question ${index + 1}`;
  if (!isRecord(raw)) throw new Error(`${where} must be an object.`);
  const prompt = text(raw.question);
  const answer = text(raw.answer);
  if (!prompt) throw new Error(`${where} has no "question".`);
  if (!answer) throw new Error(`${where} has no "answer".`);
  if (raw.type !== "choice") return { kind: "short", prompt, answer };
  const options = Array.isArray(raw.options) ? raw.options.map(text).filter(Boolean) : [];
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS)
    throw new Error(`${where} needs ${MIN_OPTIONS} to ${MAX_OPTIONS} "options".`);
  const correct = options.find((option) => option.toLowerCase() === answer.toLowerCase());
  if (!correct) throw new Error(`${where}: "answer" must be the exact text of one of its options.`);
  return { kind: "choice", prompt, options, answer: correct };
}

export function parseQuiz(args: Record<string, unknown>): Quiz {
  const title = text(args.title);
  if (!title) throw new Error('Missing "title".');
  const raw = args.questions;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Missing "questions".');
  if (raw.length > MAX_QUESTIONS) throw new Error(`A quiz can have at most ${MAX_QUESTIONS} questions.`);
  return { title, questions: raw.map(question) };
}

export function quizFromArguments(argumentsText: string): Quiz | null {
  try {
    return parseQuiz(parsePartialObject(argumentsText));
  } catch {
    return null;
  }
}

const GRADING =
  "The user finished a quiz that you wrote from their notes and submitted these answers. Grade each answer against the answer key. A multiple choice answer is right only if it matches the key. Accept a short answer when it means the same thing as the key, even if worded differently, and give partial credit in words only when it is half right. Reply with the score first (for example 3 of 5), then go through the questions that were wrong or left blank: say the correct answer and explain it in a sentence using only what the notes say. Do not add facts from outside the notes. End with one short sentence of encouragement and offer to quiz again on the weak spots.";

export function quizSubmission(quiz: Quiz, answers: string[]): string {
  const blocks = quiz.questions.map((item, index) => {
    const given = answers[index]?.trim() || "(no answer)";
    const options = item.kind === "choice" ? `\nOptions: ${item.options.join(" | ")}` : "";
    const kind = item.kind === "choice" ? "multiple choice" : "short answer";
    return `Question ${index + 1} (${kind}): ${item.prompt}${options}\nAnswer key: ${item.answer}\nUser's answer: ${given}`;
  });
  return `${GRADING}\n\nQuiz: ${quiz.title}\n\n${blocks.join("\n\n")}`;
}
