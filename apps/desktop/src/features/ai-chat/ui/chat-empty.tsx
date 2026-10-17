import { Bot } from "lucide-react";
import { isDrawing } from "../../../entities/note/lib/note-format";
import { useNoteFormat } from "../../../entities/note/model/note-list-store";
import { AI_SETTINGS_PATH } from "../../../shared/config/routes";
import { navigate } from "../../../shared/lib/hash-router";
import { Button } from "../../../shared/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../shared/ui/empty";
import { Spinner } from "../../../shared/ui/spinner";
import { useCurrentNoteId } from "../hooks/use-current-note";
import { setDraft } from "../model/chat-store";
import { useModels } from "../model/models-store";

const NOTE_PROMPTS = [
  "Summarize this note",
  "Clean up the formatting of this note",
  "Make a to-do list from this note",
];
const GENERAL_PROMPTS = ["What have I written about ", "Create a note with ideas for ", "Find my notes about "];
const DRAWING_PROMPTS = ["Explain this drawing", "Describe the connections in this drawing", "Summarize this diagram"];

function Suggestions({ prompts }: { prompts: string[] }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          className="justify-start bg-transparent font-normal"
          onClick={() => setDraft(prompt)}
        >
          {prompt.trim()}
        </Button>
      ))}
    </div>
  );
}

export function ChatEmpty() {
  const { sources, loaded } = useModels();
  const noteId = useCurrentNoteId();
  const drawing = isDrawing(useNoteFormat(noteId));
  const hasModels = sources.some((source) => source.models.length > 0);

  if (!loaded) {
    return (
      <Empty className="flex-1">
        <Spinner className="text-muted-foreground" />
      </Empty>
    );
  }

  if (!hasModels) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bot />
          </EmptyMedia>
          <EmptyTitle>Set up local AI</EmptyTitle>
          <EmptyDescription>
            Download a model to chat with AI on this device, or connect your own Ollama or AI server. Your notes stay on
            your computer.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={() => navigate(AI_SETTINGS_PATH)}>
            Open AI settings
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Bot />
        </EmptyMedia>
        <EmptyTitle>How can I help?</EmptyTitle>
        <EmptyDescription>
          {drawing
            ? "I can explain the text, shapes and connections in your drawing, and find related notes."
            : "I can write, format and organize your notes, and find things you wrote before."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Suggestions prompts={drawing ? DRAWING_PROMPTS : noteId !== null ? NOTE_PROMPTS : GENERAL_PROMPTS} />
      </EmptyContent>
    </Empty>
  );
}
