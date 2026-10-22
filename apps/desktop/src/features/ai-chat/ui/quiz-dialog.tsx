import { useId } from "react";
import { counted } from "../../../shared/lib/plural";
import { Button } from "../../../shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog";
import { Textarea } from "../../../shared/ui/textarea";
import { MAX_ANSWER_CHARS, type Quiz, type QuizQuestion } from "../lib/quiz";
import { ChatMarkdown } from "./chat-markdown";

interface QuestionProps {
  index: number;
  question: QuizQuestion;
  answer: string;
  onAnswer: (answer: string) => void;
}

function Question({ index, question, answer, onAnswer }: QuestionProps) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <div id={labelId} className="flex gap-2 font-medium">
        <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
        <ChatMarkdown text={question.prompt} />
      </div>
      {question.kind === "choice" ? (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-[13px]/relaxed has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring/30"
            >
              <input
                type="radio"
                name={labelId}
                checked={answer === option}
                onChange={() => onAnswer(option)}
                className="mt-[0.3em] accent-primary"
              />
              <span className="min-w-0 wrap-break-word">{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <Textarea
          value={answer}
          rows={2}
          maxLength={MAX_ANSWER_CHARS}
          aria-labelledby={labelId}
          placeholder="Type your answer"
          onChange={(event) => onAnswer(event.target.value)}
          className="min-h-14 text-[13px]/relaxed"
        />
      )}
    </div>
  );
}

interface QuizDialogProps {
  quiz: Quiz;
  answers: string[];
  running: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnswer: (index: number, answer: string) => void;
  onSubmit: () => void;
}

export function QuizDialog({ quiz, answers, running, open, onOpenChange, onAnswer, onSubmit }: QuizDialogProps) {
  const answered = answers.filter((answer) => answer.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{quiz.title}</DialogTitle>
          <DialogDescription>
            {counted(quiz.questions.length, "question")}, written from your notes. {answered} answered.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex flex-col gap-5 overflow-y-auto px-1 py-1">
          {quiz.questions.map((question, index) => (
            <Question
              key={index}
              index={index}
              question={question}
              answer={answers[index] ?? ""}
              onAnswer={(answer) => onAnswer(index, answer)}
            />
          ))}
        </div>
        <DialogFooter className="items-center">
          {running && <span className="text-muted-foreground sm:mr-auto">Wait for the AI to finish replying.</span>}
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button disabled={answered === 0 || running} onClick={onSubmit}>
            Submit answers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
