import { useState } from "react";
import { updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { DEFAULT_AGENT_INSTRUCTIONS } from "../../../features/ai-chat/lib/agent-prompt";
import { Button } from "../../../shared/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Textarea } from "../../../shared/ui/textarea";
import { SETTING_IDS } from "../model/settings-search";
import { SettingsGroup } from "./settings-group";

function InstructionsEditor({ saved }: { saved: string }) {
  const [text, setText] = useState(saved);
  const isDefault = saved === DEFAULT_AGENT_INSTRUCTIONS && text === DEFAULT_AGENT_INSTRUCTIONS;
  const save = (next: string) =>
    updateAiSettings({ instructions: next.trim() === DEFAULT_AGENT_INSTRUCTIONS ? null : next });

  return (
    <>
      <Textarea
        aria-label="Agent instructions"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        className="mx-(--card-spacing) w-auto max-h-[60vh] min-h-80 font-mono text-xs/relaxed"
      />
      <div className="flex items-center justify-end gap-2 px-(--card-spacing)">
        <Button
          variant="outline"
          size="sm"
          disabled={isDefault}
          onClick={() => {
            setText(DEFAULT_AGENT_INSTRUCTIONS);
            updateAiSettings({ instructions: null });
          }}
        >
          Reset to default
        </Button>
        <Button size="sm" disabled={text === saved || !text.trim()} onClick={() => save(text)}>
          Save
        </Button>
      </div>
    </>
  );
}

export function AgentSection() {
  const saved = useSettings().ai.instructions ?? DEFAULT_AGENT_INSTRUCTIONS;

  return (
    <SettingsGroup name="agent" title="Agent instructions">
      <Card id={SETTING_IDS.agentInstructions} size="sm">
        <CardHeader>
          <CardTitle>Compose AI</CardTitle>
          <CardDescription>
            The main instructions every chat starts with. They describe the assistant&apos;s role in the app and what it
            can do. Installed skills and the notes you have open are added after them.
          </CardDescription>
        </CardHeader>
        <InstructionsEditor key={saved} saved={saved} />
      </Card>
    </SettingsGroup>
  );
}
