import { ChevronDown } from "lucide-react";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { Button } from "../../../shared/ui/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { SETTING_IDS } from "../model/settings-search";
import { chooseMicrophone, useVoice } from "../model/voice";

const SYSTEM_DEFAULT = "default";
const SYSTEM_DEFAULT_LABEL = "System default";

export function MicrophoneRow() {
  const { micDevice } = useSettings();
  const { microphones } = useVoice();
  const chosen = microphones.find((microphone) => microphone.id === micDevice);

  return (
    <CardHeader id={SETTING_IDS.microphone}>
      <CardTitle id="microphone-label">Microphone</CardTitle>
      <CardDescription>Used for voice notes and the recording shortcut.</CardDescription>
      <CardAction className="self-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="max-w-72 min-w-48 justify-start gap-2"
                aria-labelledby="microphone-label"
              />
            }
          >
            <span className="truncate">{chosen?.name ?? SYSTEM_DEFAULT_LABEL}</span>
            <ChevronDown className="ml-auto text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-auto min-w-(--anchor-width)">
            <DropdownMenuRadioGroup
              value={chosen?.id ?? SYSTEM_DEFAULT}
              onValueChange={(value: unknown) =>
                chooseMicrophone(value === SYSTEM_DEFAULT || typeof value !== "string" ? null : value)
              }
            >
              <DropdownMenuRadioItem value={SYSTEM_DEFAULT} closeOnClick>
                {SYSTEM_DEFAULT_LABEL}
              </DropdownMenuRadioItem>
              {microphones.length > 0 && <DropdownMenuSeparator />}
              {microphones.map((microphone) => (
                <DropdownMenuRadioItem
                  key={microphone.id}
                  value={microphone.id}
                  closeOnClick
                  className="whitespace-nowrap"
                >
                  {microphone.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
  );
}
