import { cn } from "cn";
import { Ellipsis } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useAfterMenuClose } from "../../../shared/hooks/use-after-menu-close";
import { Button } from "../../../shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../../shared/ui/dropdown-menu";

export const EMBED_CONTROL = "[data-embed-control]";

interface EmbedMenuProps {
  label: string;
  className?: string;
  children: (afterClose: (action: () => void) => void) => ReactNode;
}

export function EmbedMenu({ label, className, children }: EmbedMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLElement | null>(null);
  const { afterClose, onOpenChangeComplete } = useAfterMenuClose();

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) editor.current = trigger.current?.closest<HTMLElement>(".cm-content") ?? null;
      }}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DropdownMenuTrigger
        render={
          <Button
            ref={trigger}
            data-embed-control
            variant="secondary"
            size="icon-sm"
            aria-label={label}
            className={cn(
              "absolute top-1.5 right-1.5 opacity-0 shadow-sm group-hover/media:opacity-100 data-popup-open:opacity-100",
              className,
            )}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto" finalFocus={() => editor.current ?? true}>
        {children(afterClose)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
