import type { SkillSummary } from "../../../shared/api/skills";

const MIN_WORD = 3;

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD);

export function matchingSkills(message: string, skills: SkillSummary[]): SkillSummary[] {
  const said = words(message);
  return skills.filter((skill) => {
    const name = words(skill.name);
    return skill.enabled && name.length > 0 && name.every((part) => said.some((word) => word.startsWith(part)));
  });
}
