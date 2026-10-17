import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { IconActionButton } from "./icon-action-button";

interface PixelSnappedActionButtonProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}

export function PixelSnappedActionButton({ icon: Icon, className, ...props }: PixelSnappedActionButtonProps) {
  return (
    <IconActionButton variant="ghost" data-pixel-snap className={cn("size-[25px] rounded-md", className)} {...props}>
      <Icon className="size-[13px]" />
    </IconActionButton>
  );
}
