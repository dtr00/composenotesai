import { memo, type SyntheticEvent } from "react";
import { snapWithin } from "../../../shared/lib/pixel-snap";
import { Bubble, BubbleContent } from "../../../shared/ui/bubble";
import { Message, MessageContent } from "../../../shared/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "../../../shared/ui/message-scroller";
import { countChanges, noteChangesFrom, type ChangeCounts } from "../lib/note-changes";
import { useChat } from "../model/chat-store";
import type { UserMessage } from "../model/conversation";
import { AssistantReply } from "./assistant-message";
import { ChatEmpty } from "./chat-empty";
import { SentAttachments } from "./sent-attachments";
import { UserMessageActions } from "./user-message-actions";

const BOTTOM_SLACK_PX = 24;

// WebKitGTK can leave the faded-out button painted until something repaints it, so it also turns invisible once the fade ends.
const SCROLL_BUTTON =
  "rounded-full transition-[translate,scale,opacity,visibility] data-[active=false]:invisible data-[active=true]:visible";

const snapTarget = (event: SyntheticEvent<HTMLElement>) => snapWithin(event.currentTarget);

interface UserPromptProps {
  message: UserMessage;
  changes: ChangeCounts;
  running: boolean;
}

const UserPrompt = memo(function UserPrompt({ message, changes, running }: UserPromptProps) {
  return (
    <Message align="end" onPointerEnter={snapTarget} onFocus={snapTarget}>
      <MessageContent>
        <SentAttachments attachments={message.attachments} />
        <Bubble variant="secondary" align="end">
          <BubbleContent className="text-[13px]/relaxed whitespace-pre-wrap select-text">{message.text}</BubbleContent>
        </Bubble>
        <UserMessageActions message={message} changes={changes} running={running} />
      </MessageContent>
    </Message>
  );
});

export function ChatThread() {
  const { messages, running, id } = useChat();
  if (messages.length === 0) return <ChatEmpty />;
  const last = messages.length - 1;

  return (
    <MessageScrollerProvider
      key={id ?? "new"}
      autoScroll
      defaultScrollPosition="end"
      scrollEdgeThreshold={BOTTOM_SLACK_PX}
    >
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Conversation">
          <MessageScrollerContent className="gap-5 px-3 pt-2 pb-4">
            {messages.map((message, index) => (
              <MessageScrollerItem key={message.id} messageId={message.id}>
                {message.role === "user" ? (
                  <UserPrompt
                    message={message}
                    changes={countChanges(noteChangesFrom(messages, index))}
                    running={running}
                  />
                ) : (
                  <AssistantReply message={message} running={running && index === last} />
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className={SCROLL_BUTTON} />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
