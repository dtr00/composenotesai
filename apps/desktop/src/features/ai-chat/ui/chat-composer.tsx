import { cn } from "cn";
import { ArrowUp, Square } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useComposerDrop } from "../hooks/use-composer-drop";
import { useCurrentNoteId } from "../hooks/use-current-note";
import { useMentions } from "../hooks/use-mentions";
import { attachComposer, composer } from "../model/chat-panel";
import { sendMessage, setDraft, stopRun, useChatRunning, useDraft } from "../model/chat-store";
import { useModelChoice } from "../model/models-store";
import { useVoiceMessageState } from "../model/voice-message";
import { AttachMenu } from "./attach-menu";
import { IconActionButton } from "./icon-action-button";
import { MentionPicker } from "./mention-picker";
import { ModelPicker } from "./model-picker";
import { PendingAttachments } from "./pending-attachments";
import { RecordButton, VoiceRecorder } from "./voice-message";
import { WebSearchToggle } from "./web-search-toggle";

interface ComposerActionProps {
  running: boolean;
  empty: boolean;
  disabled: boolean;
  onSend: () => void;
}

function ComposerAction({ running, empty, disabled, onSend }: ComposerActionProps) {
  if (running)
    return (
      <IconActionButton label="Stop" variant="secondary" onClick={stopRun}>
        <Square className="size-3 fill-current" />
      </IconActionButton>
    );
  if (empty) return <RecordButton disabled={disabled} />;
  return (
    <IconActionButton label="Send" disabled={disabled} onClick={onSend}>
      <ArrowUp className="size-3.5" />
    </IconActionButton>
  );
}

export function ChatComposer() {
  const draft = useDraft();
  const running = useChatRunning();
  const viewingNote = useCurrentNoteId() !== null;
  const choice = useModelChoice();
  const [dropping, dropZone] = useComposerDrop();
  const mentions = useMentions(draft, composer);
  const voiceActive = useVoiceMessageState() !== "idle";
  const empty = draft.trim().length === 0;
  const canSend = !empty && choice !== null && !running;

  const send = () => {
    if (!canSend) return;
    void sendMessage(draft);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.consumeKey(event)) return;
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div className="shrink-0 px-3 pb-2">
      <div
        ref={dropZone}
        className={cn(
          "relative flex flex-col gap-2 rounded-lg border border-input bg-background/60 p-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/20",
          dropping && "border-primary ring-2 ring-primary/30",
        )}
      >
        {mentions.suggestions.length > 0 && (
          <MentionPicker
            items={mentions.suggestions}
            highlighted={mentions.highlighted}
            onPick={mentions.pick}
            onHighlight={mentions.setHighlighted}
          />
        )}
        <PendingAttachments />
        {voiceActive ? (
          <VoiceRecorder />
        ) : (
          <>
            <textarea
              ref={attachComposer}
              value={draft}
              rows={1}
              placeholder={
                viewingNote
                  ? "Ask about this note. Use @ for notes, # for folders"
                  : "Ask Compose AI. Use @ for notes, # for folders"
              }
              aria-label="Message"
              onChange={(event) => {
                setDraft(event.target.value);
                mentions.trackCaret(event);
              }}
              onSelect={mentions.trackCaret}
              onKeyDown={onKeyDown}
              className="max-h-48 min-h-10 w-full resize-none bg-transparent px-1 text-[13px]/relaxed outline-none field-sizing-content placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1">
              <AttachMenu onMention={mentions.startMention} focusAfter={composer} />
              <div className="ml-auto flex min-w-0 items-center gap-1">
                <WebSearchToggle />
                <ModelPicker />
                <ComposerAction running={running} empty={empty} disabled={choice === null} onSend={send} />
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">AI can make mistakes.</p>
    </div>
  );
}
