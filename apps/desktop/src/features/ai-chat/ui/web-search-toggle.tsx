import { cn } from "cn";
import { Globe } from "lucide-react";
import { getSettings, updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { useOnline } from "../../../shared/hooks/use-online";
import { Button } from "../../../shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";

const toggleWebSearch = () => updateAiSettings({ webSearch: !getSettings().ai.webSearch });

function hint(on: boolean, online: boolean) {
  if (!on) return "Web search is off. Turn on to let the AI look things up online";
  return online ? "Web search is on" : "Web search is on, but you're offline";
}

export function WebSearchToggle() {
  const on = useSettings().ai.webSearch;
  const online = useOnline();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={on ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Search the web"
            aria-pressed={on}
            onClick={toggleWebSearch}
            className={cn(!on && "text-muted-foreground", on && !online && "opacity-60")}
          />
        }
      >
        <Globe className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{hint(on, online)}</TooltipContent>
    </Tooltip>
  );
}
