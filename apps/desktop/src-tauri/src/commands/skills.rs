use crate::features::skills::{raw_skill_url, Skill, SkillStore, SkillSummary};
use crate::shared::error::{Error, Result};
use tauri::State;

const MAX_DOWNLOAD_BYTES: usize = 256 * 1024;

#[tauri::command]
pub fn list_skills(skills: State<SkillStore>) -> Result<Vec<SkillSummary>> {
    skills.list()
}

#[tauri::command]
pub fn load_skill(skills: State<SkillStore>, id: i64) -> Result<Skill> {
    skills.load(id)
}

#[tauri::command]
pub fn find_skill(skills: State<SkillStore>, name: String) -> Result<Option<Skill>> {
    skills.find_enabled(&name)
}

#[tauri::command]
pub fn install_skill(
    skills: State<SkillStore>,
    text: String,
    source: Option<String>,
    fallback_name: Option<String>,
) -> Result<SkillSummary> {
    skills.install(&text, source.as_deref(), fallback_name.as_deref())
}

#[tauri::command]
pub async fn install_skill_from_url(
    skills: State<'_, SkillStore>,
    client: State<'_, reqwest::Client>,
    url: String,
) -> Result<SkillSummary> {
    let raw = raw_skill_url(&url)?;
    let response = client.get(&raw).send().await?.error_for_status()?;
    let text = response.text().await?;
    if text.len() > MAX_DOWNLOAD_BYTES {
        return Err(Error::Message("This file is too large to be a skill.".into()));
    }
    let fallback = raw.rsplit('/').nth(1).map(str::to_owned);
    skills.install(&text, Some(url.trim()), fallback.as_deref())
}

#[tauri::command]
pub fn save_skill(
    skills: State<SkillStore>,
    id: Option<i64>,
    name: String,
    description: String,
    body: String,
) -> Result<SkillSummary> {
    skills.save(id, &name, &description, &body)
}

#[tauri::command]
pub fn set_skill_enabled(skills: State<SkillStore>, id: i64, enabled: bool) -> Result<()> {
    skills.set_enabled(id, enabled)
}

#[tauri::command]
pub fn delete_skill(skills: State<SkillStore>, id: i64) -> Result<()> {
    skills.delete(id)
}
