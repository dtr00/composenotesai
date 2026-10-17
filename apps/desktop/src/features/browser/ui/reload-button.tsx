import { RotateCw, X } from "lucide-react";
import { Button } from "../../../shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { reloadBrowser, stopBrowser, usePageLoading } from "../model/browser-store";

export function ReloadButton({ tab }: { tab: number }) {
  const loading = usePageLoading(tab);
  const label = loading ? "Stop" : "Reload";
  const Icon = loading ? X : RotateCw;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-[25px]"
            aria-label={label}
            onClick={() => (loading ? stopBrowser(tab) : reloadBrowser(tab))}
          />
        }
      >
        <Icon className="size-[15px]" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
