import { cn } from "cn";
import { AgentButton } from "../../features/ai-chat/ui/agent-button";
import { ChatPanel } from "../../features/ai-chat/ui/chat-panel";
import { SidebarHeader } from "../../features/sidebar/ui/sidebar-header";
import { SidebarToggle } from "../../features/sidebar/ui/sidebar-toggle";
import { TabBar } from "../../features/tabs/ui/tab-bar";
import { NotesPage } from "../../pages/notes/page";
import { SettingsPage } from "../../pages/settings/page";
import { isSettingsPath } from "../../shared/config/routes";
import { useHashPath } from "../../shared/lib/hash-router";
import { isMacOS } from "../../shared/lib/platform";
import { TitleBar } from "./title-bar";

export function App() {
  const path = useHashPath();

  return (
    <>
      <TitleBar actions={<AgentButton />}>
        <SidebarHeader className={cn("pr-1", isMacOS ? "pl-20" : "pl-1")}>
          <SidebarToggle />
        </SidebarHeader>
        <div className="flex h-full min-w-0 flex-1">
          <TabBar />
        </div>
      </TitleBar>
      <div className="flex min-h-0 flex-1 overflow-clip">
        <div className="flex min-w-0 flex-1">{isSettingsPath(path) ? <SettingsPage /> : <NotesPage />}</div>
        <ChatPanel />
      </div>
    </>
  );
}
