import { Settings } from "lucide-react";
import { SETTINGS_PATH } from "../../../shared/config/routes";
import { Link } from "../../../shared/ui/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";

export function SettingsLink() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`#${SETTINGS_PATH}`}
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Settings"
          />
        }
      >
        <Settings aria-hidden />
      </TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
  );
}
