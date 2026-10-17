import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "../../../shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { goBack, goForward, useHistoryState } from "../model/tabs-store";

function HistoryButton({
  label,
  Icon,
  onClick,
  disabled,
}: {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-[25px]"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        <Icon className="size-[15px]" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function HistoryButtons() {
  const { canGoBack, canGoForward } = useHistoryState();

  return (
    <>
      <HistoryButton label="Back" Icon={ArrowLeft} onClick={goBack} disabled={!canGoBack} />
      <HistoryButton label="Forward" Icon={ArrowRight} onClick={goForward} disabled={!canGoForward} />
    </>
  );
}
