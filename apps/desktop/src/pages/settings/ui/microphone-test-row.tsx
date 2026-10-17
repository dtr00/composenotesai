import { Button } from "../../../shared/ui/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Progress } from "../../../shared/ui/progress";
import { SETTING_IDS } from "../model/settings-search";
import { toggleTest, useVoice } from "../model/voice";

export function MicrophoneTestRow() {
  const { testing, level } = useVoice();

  return (
    <CardHeader id={SETTING_IDS.microphoneTest}>
      <CardTitle>Test microphone</CardTitle>
      <CardDescription>Speak and watch the level move. Nothing is saved.</CardDescription>
      <CardAction className="flex items-center gap-3 self-center">
        {testing && <Progress value={level * 100} aria-label="Microphone level" className="w-28" />}
        <Button variant="outline" onClick={() => void toggleTest()}>
          {testing ? "Stop" : "Test"}
        </Button>
      </CardAction>
    </CardHeader>
  );
}
