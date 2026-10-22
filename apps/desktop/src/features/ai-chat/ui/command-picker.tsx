import { cn } from "cn";
import type { ChatCommand } from "../config/chat-commands";

interface CommandPickerProps {
  commands: ChatCommand[];
  highlighted: number;
  onPick: (command: ChatCommand) => void;
  onHighlight: (index: number) => void;
}

export function CommandPicker({ commands, highlighted, onPick, onHighlight }: CommandPickerProps) {
  return (
    <div
      role="listbox"
      aria-label="Commands"
      className="absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {commands.map((command, index) => (
        <div
          key={command.name}
          role="option"
          aria-selected={index === highlighted}
          onPointerDown={(event) => {
            event.preventDefault();
            onPick(command);
          }}
          onPointerMove={() => onHighlight(index)}
          className={cn(
            "flex cursor-default flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs",
            index === highlighted && "bg-accent text-accent-foreground",
          )}
        >
          <span className="font-medium">/{command.name}</span>
          <span className="text-muted-foreground">{command.description}</span>
        </div>
      ))}
    </div>
  );
}
