import { Bot, Database, Keyboard, Mic, Palette, Server, SlidersHorizontal, type LucideIcon } from "lucide-react";
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
} from "../../../shared/config/routes";

const SECTIONS = [
  { path: SETTINGS_PATH, label: "General", Icon: SlidersHorizontal, subpages: [] },
  { path: APPEARANCE_SETTINGS_PATH, label: "Appearance", Icon: Palette, subpages: [] },
  {
    path: AI_SETTINGS_PATH,
    label: "AI",
    Icon: Bot,
    subpages: [
      { path: SKILLS_SETTINGS_PATH, label: "Skills" },
      { path: AGENT_SETTINGS_PATH, label: "Agent instructions" },
    ],
  },
  { path: VOICE_SETTINGS_PATH, label: "Voice", Icon: Mic, subpages: [] },
  { path: KEYBINDINGS_SETTINGS_PATH, label: "Keybindings", Icon: Keyboard, subpages: [] },
  {
    path: STORAGE_SETTINGS_PATH,
    label: "Storage",
    Icon: Database,
    subpages: [{ path: TRASH_SETTINGS_PATH, label: "Trash" }],
  },
  { path: SYSTEM_SETTINGS_PATH, label: "System", Icon: Server, subpages: [] },
] as const;

type Section = (typeof SECTIONS)[number];

export type SectionPath = Section["path"];

export type SettingsPath = SectionPath | Section["subpages"][number]["path"];

export interface SettingsPageInfo {
  path: SettingsPath;
  label: string;
}

export interface SettingsSection extends SettingsPageInfo {
  path: SectionPath;
  Icon: LucideIcon;
  subpages: readonly SettingsPageInfo[];
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = SECTIONS;

export const sectionLabel = (path: SectionPath) => SETTINGS_SECTIONS.find((section) => section.path === path)!.label;

export function settingsPageAt(path: string): { section: SettingsSection; subpage?: SettingsPageInfo } {
  const section =
    SETTINGS_SECTIONS.find(
      (candidate) => candidate.path === path || candidate.subpages.some((page) => page.path === path),
    ) ?? SETTINGS_SECTIONS[0];
  return { section, subpage: section.subpages.find((page) => page.path === path) };
}
