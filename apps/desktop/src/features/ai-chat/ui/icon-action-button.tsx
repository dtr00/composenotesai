import type { ComponentProps } from "react";
import { Button } from "../../../shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";

type IconActionButtonProps = Omit<ComponentProps<typeof Button>, "size" | "aria-label"> & {
  label: string;
  hint?: string;
};

export function IconActionButton({ label, hint = label, children, ...button }: IconActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" aria-label={label} {...button} />}>{children}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
