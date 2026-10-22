import { ListChecks } from "lucide-react";
import { useState } from "react";
import { counted } from "../../../shared/lib/plural";
import { Button } from "../../../shared/ui/button";
import { quizSubmission, type Quiz } from "../lib/quiz";
import { sendMessage, useChatRunning, useQuizSubmitted } from "../model/chat-store";
import { QuizDialog } from "./quiz-dialog";

interface QuizCardProps {
  callId: string;
  quiz: Quiz;
}

export function QuizCard({ callId, quiz }: QuizCardProps) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const submitted = useQuizSubmitted(callId);
  const running = useChatRunning();

  const submit = () => {
    setOpen(false);
    void sendMessage(`Here are my answers to the quiz "${quiz.title}".`, {
      callId,
      attachment: { kind: "file", name: `Quiz answers: ${quiz.title}`, content: quizSubmission(quiz, answers) },
    });
    setAnswers([]);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground">
      <ListChecks className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium">{quiz.title}</span>
        <span className="text-xs text-muted-foreground">
          Quiz · {counted(quiz.questions.length, "question")}
          {submitted && " · Submitted"}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {submitted ? "Retake quiz" : "Open quiz"}
      </Button>
      <QuizDialog
        quiz={quiz}
        answers={answers}
        running={running}
        open={open}
        onOpenChange={setOpen}
        onAnswer={(index, answer) =>
          setAnswers((current) =>
            Array.from({ length: quiz.questions.length }, (_, at) => (at === index ? answer : (current[at] ?? ""))),
          )
        }
        onSubmit={submit}
      />
    </div>
  );
}
