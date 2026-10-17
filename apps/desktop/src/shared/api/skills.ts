import { invoke } from "@tauri-apps/api/core";

export interface SkillSummary {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  source: string | null;
  bytes: number;
}

export interface Skill extends SkillSummary {
  body: string;
}

export const listSkills = () => invoke<SkillSummary[]>("list_skills");

export const loadSkill = (id: number) => invoke<Skill>("load_skill", { id });

export const findSkill = (name: string) => invoke<Skill | null>("find_skill", { name });

export const installSkill = (text: string, source: string | null, fallbackName: string | null) =>
  invoke<SkillSummary>("install_skill", { text, source, fallbackName });

export const installSkillFromUrl = (url: string) => invoke<SkillSummary>("install_skill_from_url", { url });

export const saveSkill = (id: number | null, name: string, description: string, body: string) =>
  invoke<SkillSummary>("save_skill", { id, name, description, body });

export const setSkillEnabled = (id: number, enabled: boolean) => invoke<void>("set_skill_enabled", { id, enabled });

export const deleteSkill = (id: number) => invoke<void>("delete_skill", { id });
