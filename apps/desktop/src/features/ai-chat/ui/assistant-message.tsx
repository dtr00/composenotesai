import { BookOpen } from "lucide-react";
import { memo, type SyntheticEvent } from "react";
import { Bubble, BubbleContent } from "../../../shared/ui/bubble";
import { snapWithin } from "../../../shared/lib/pixel-snap";
import { Message, MessageContent, MessageFooter } from "../../../shared/ui/message";
import { Spinner } from "../../../shared/ui/spinner";
import type { AssistantMessage } from "../model/conversation";
import { AgentProcess, type ProcessStep } from "./agent-process";
import { ChatMarkdown } from "./chat-markdown";
import { CopyButton } from "./copy-button";

interface Process {
  kind: "process";
  steps: ProcessStep[];
  index: number;
  endedAt: number | undefined;
}

type Segment = { kind: "text"; text: string; index: number } | Process;

function segments({ parts, finishedAt }: AssistantMessage): Segment[] {
  const out: Segment[] = [];
  parts.forEach((part, index) => {
    const previous = out[out.length - 1];
    if (part.kind === "text") {
      if (!part.text.trim()) return;
      if (previous?.kind === "process") previous.endedAt = part.startedAt;
      out.push({ kind: "text", text: part.text, index });
    } else if (previous?.kind === "process") previous.steps.push(part);
    else out.push({ kind: "process", steps: [part], index, endedAt: undefined });
  });
  const last = out[out.length - 1];
  if (last?.kind === "process") last.endedAt = finishedAt;
  return out;
}

function elapsed({ steps, endedAt }: Process): number | null {
  const startedAt = steps[0].startedAt;
  return startedAt === undefined || endedAt === undefined ? null : endedAt - startedAt;
}

const snapTarget = (event: SyntheticEvent<HTMLElement>) => snapWithin(event.currentTarget);

const speedFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const replyText = (message: AssistantMessage) =>
  message.parts
    .flatMap((part) => (part.kind === "text" ? [part.text] : []))
    .join("")
    .trim();

function Footer({ message }: { message: AssistantMessage }) {
  const text = replyText(message);
  const speed = message.stats?.tokensPerSecond;
  return (
    <MessageFooter className="gap-1 px-0">
      <span className="truncate">{message.model}</span>
      {message.stopped && <span className="shrink-0">· Stopped</span>}
      {speed ? <span className="shrink-0 tabular-nums">· {speedFormat.format(speed)} tokens/s</span> : null}
      {text && (
        <CopyButton
          text={text}
          label="Copy reply"
          className="opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100"
        />
      )}
    </MessageFooter>
  );
}

export const AssistantReply = memo(function AssistantReply({
  message,
  running,
}: {
  message: AssistantMessage;
  running: boolean;
}) {
  const pieces = segments(message);

  return (
    <Message onPointerEnter={snapTarget} onFocus={snapTarget}>
      <MessageContent className="gap-2.5">
        {message.skills.map((skill) => (
          <span key={skill} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" />
            Using the {skill} skill
          </span>
        ))}
        {pieces.map((segment, position) =>
          segment.kind === "text" ? (
            <ChatMarkdown key={segment.index} text={segment.text} />
          ) : (
            <AgentProcess
              key={segment.index}
              steps={segment.steps}
              elapsed={elapsed(segment)}
              active={running && position === pieces.length - 1}
            />
          ),
        )}
        {message.status && (
          <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" aria-hidden />
            <span className="animate-pulse">{message.status}</span>
          </div>
        )}
        {message.error && (
          <Bubble variant="destructive" className="max-w-full">
            <BubbleContent role="alert">{message.error}</BubbleContent>
          </Bubble>
        )}
        {!running && <Footer message={message} />}
      </MessageContent>
    </Message>
  );
});
