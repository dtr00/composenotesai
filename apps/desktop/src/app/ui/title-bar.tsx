import { cn } from "cn";
import { Copy, Minus, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "../../shared/api/windows";
import { isMacOS } from "../../shared/lib/platform";
import { useWindowMaximized } from "../../shared/lib/window-frame";
import { TitleBarButton } from "../../shared/ui/title-bar-button";

const CONTROL = "h-full w-11 rounded-none";

function WindowControls() {
  const isMaximized = useWindowMaximized();

  return (
    <div className="flex h-full">
      <TitleBarButton size="default" className={CONTROL} aria-label="Minimize" onClick={() => void minimizeWindow()}>
        <Minus />
      </TitleBarButton>
      <TitleBarButton
        size="default"
        className={CONTROL}
        aria-label={isMaximized ? "Restore" : "Maximize"}
        onClick={() => void toggleMaximizeWindow()}
      >
        {isMaximized ? <Copy className="size-3 -scale-x-100" /> : <Square className="size-3" />}
      </TitleBarButton>
      <TitleBarButton
        size="default"
        className={cn(
          CONTROL,
          "hover:bg-destructive hover:text-background dark:hover:bg-destructive dark:hover:text-foreground",
        )}
        aria-label="Close"
        onClick={() => void closeWindow()}
      >
        <X />
      </TitleBarButton>
    </div>
  );
}

interface TitleBarProps {
  children?: ReactNode;
  actions?: ReactNode;
}

export function TitleBar({ children, actions }: TitleBarProps) {
  return (
    <header
      data-tauri-drag-region="deep"
      className="flex h-9 shrink-0 items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground select-none sidebar-surface"
    >
      {children}
      <div className="ml-auto flex h-full items-center">
        {actions}
        {!isMacOS && <WindowControls />}
      </div>
    </header>
  );
}
