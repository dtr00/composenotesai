import { ArrowLeft } from "lucide-react";
import type { ComponentType } from "react";
import { PanelBackground } from "../../features/panel-background/ui/panel-background";
import { LEAVE_SETTINGS_HOTKEY } from "../../entities/settings/model/reserved-hotkeys";
import { Sidebar } from "../../features/sidebar/ui/sidebar";
import { SidebarPanel } from "../../features/sidebar/ui/sidebar-panel";
import {
  AGENT_SETTINGS_PATH,
  AI_SETTINGS_PATH,
  APPEARANCE_SETTINGS_PATH,
  KEYBINDINGS_SETTINGS_PATH,
  SETTINGS_PATH,
  SKILLS_SETTINGS_PATH,
  STORAGE_SETTINGS_PATH,
  SYSTEM_SETTINGS_PATH,
  TRASH_SETTINGS_PATH,
  VOICE_SETTINGS_PATH,
} from "../../shared/config/routes";
import { useHashPath } from "../../shared/lib/hash-router";
import { Button } from "../../shared/ui/button";
import { Shortcut } from "../../shared/ui/shortcut";
import { leaveSettings } from "./model/settings-navigation";
import { settingsPageAt, type SettingsPageInfo, type SettingsPath } from "./model/settings-sections";
import { AgentSection } from "./ui/agent-section";
import { AiSection } from "./ui/ai-section";
import { GeneralSection } from "./ui/general-section";
import { SkillsSection } from "./ui/skills-section";
import { SettingsToolbar } from "./ui/settings-toolbar";
import { AppearanceSection } from "./ui/appearance-section";
import { KeybindingsSection } from "./ui/keybindings-section";
import { SettingsNav } from "./ui/settings-nav";
import { StorageSection } from "./ui/storage-section";
import { SystemSection } from "./ui/system-section";
import { TrashSection } from "./ui/trash-section";
import { VoiceSection } from "./ui/voice-section";

const CONTENT = {
  [SETTINGS_PATH]: GeneralSection,
  [APPEARANCE_SETTINGS_PATH]: AppearanceSection,
  [AI_SETTINGS_PATH]: AiSection,
  [SKILLS_SETTINGS_PATH]: SkillsSection,
  [AGENT_SETTINGS_PATH]: AgentSection,
  [VOICE_SETTINGS_PATH]: VoiceSection,
  [KEYBINDINGS_SETTINGS_PATH]: KeybindingsSection,
  [STORAGE_SETTINGS_PATH]: StorageSection,
  [TRASH_SETTINGS_PATH]: TrashSection,
  [SYSTEM_SETTINGS_PATH]: SystemSection,
} satisfies Record<SettingsPath, ComponentType>;

export function SettingsPage() {
  const { section, subpage } = settingsPageAt(useHashPath());
  const Content = CONTENT[(subpage ?? section).path];
  const trail: SettingsPageInfo[] = [
    { label: "Settings", path: SETTINGS_PATH },
    section,
    ...(subpage ? [subpage] : []),
  ];

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar>
        <SidebarPanel
          aria-label="Settings"
          footer={
            <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={leaveSettings}>
              <ArrowLeft data-icon="inline-start" />
              Back
              <Shortcut hotkey={LEAVE_SETTINGS_HOTKEY} className="ml-auto" />
            </Button>
          }
        >
          <SettingsNav currentPath={section.path} />
        </SidebarPanel>
      </Sidebar>
      <main className="relative isolate flex min-w-0 flex-1 flex-col">
        <PanelBackground />
        <SettingsToolbar trail={trail} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pt-2 pb-6 select-none">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            <Content />
          </div>
        </div>
      </main>
    </div>
  );
}
