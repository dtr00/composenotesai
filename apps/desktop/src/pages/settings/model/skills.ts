import {
  deleteSkill,
  installSkill,
  installSkillFromUrl,
  listSkills,
  loadSkill,
  saveSkill,
  setSkillEnabled,
  type Skill,
  type SkillSummary,
} from "../../../shared/api/skills";
import { reportAction } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

interface SkillsState {
  skills: SkillSummary[] | null;
}

const store = createStore<SkillsState>({ skills: null });

export const useSkills = () => useStore(store);

export async function refreshSkills() {
  const skills = await reportAction(listSkills());
  if (skills) updateStore(store, { skills });
}

async function changed<T>(work: Promise<T>): Promise<T | undefined> {
  const result = await reportAction(work);
  await refreshSkills();
  return result;
}

export const installSkillText = (text: string, source: string | null, fallbackName: string | null) =>
  changed(installSkill(text, source, fallbackName));

export const installSkillLink = (url: string) => changed(installSkillFromUrl(url));

export const writeSkill = (id: number | null, name: string, description: string, body: string) =>
  changed(saveSkill(id, name, description, body));

export const toggleSkill = (id: number, enabled: boolean) => changed(setSkillEnabled(id, enabled));

export const removeSkill = (id: number) => changed(deleteSkill(id));

export const openSkill = (id: number): Promise<Skill | undefined> => reportAction(loadSkill(id));

export async function installSkillFiles(files: FileList | null) {
  for (const file of files ? [...files] : []) {
    const text = await file.text();
    const stem = file.name.replace(/\.md$/i, "");
    await installSkillText(text, file.name, stem.toLowerCase() === "skill" ? null : stem);
  }
}
