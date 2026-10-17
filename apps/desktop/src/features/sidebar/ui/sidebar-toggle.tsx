import { PanelLeft } from "lucide-react";
import { useHotkey } from "../../../entities/settings/model/keybindings";
import { Shortcut } from "../../../shared/ui/shortcut";
import { TitleBarButton } from "../../../shared/ui/title-bar-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { toggleSidebar, useSidebarOpen } from "../model/sidebar-store";

export function SidebarToggle() {
  const open = useSidebarOpen();
  const hotkey = useHotkey("toggleSidebar");

  return (
    <Tooltip>
      <TooltipTrigger
        render={<TitleBarButton aria-label={open ? "Close sidebar" : "Open sidebar"} onClick={toggleSidebar} />}
      >
        <PanelLeft aria-hidden>
          {open && <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4z" fill="currentColor" />}
        </PanelLeft>
      </TooltipTrigger>
      <TooltipContent>
        Toggle sidebar
        <Shortcut hotkey={hotkey} />
      </TooltipContent>
    </Tooltip>
  );
}
