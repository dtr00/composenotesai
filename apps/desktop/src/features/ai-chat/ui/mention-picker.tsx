import { cn } from "cn";
import type { MentionItem } from "../hooks/use-mentions";
import { AttachmentIcon } from "./attachment-icon";

interface MentionPickerProps {
  items: MentionItem[];
  highlighted: number;
  onPick: (item: MentionItem) => void;
  onHighlight: (index: number) => void;
}

export function MentionPicker({ items, highlighted, onPick, onHighlight }: MentionPickerProps) {
  const folders = items[0]?.kind === "folder";

  return (
    <div
      role="listbox"
      aria-label={folders ? "Folders" : "Notes"}
      className="absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {items.map((item, index) => {
        return (
          <div
            key={`${item.kind}-${item.id}`}
            role="option"
            aria-selected={index === highlighted}
            onPointerDown={(event) => {
              event.preventDefault();
              onPick(item);
            }}
            onPointerMove={() => onHighlight(index)}
            className={cn(
              "flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 text-xs",
              index === highlighted && "bg-accent text-accent-foreground",
            )}
          >
            <AttachmentIcon attachment={item} className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{item.title}</span>
          </div>
        );
      })}
    </div>
  );
}
