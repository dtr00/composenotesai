use crate::entities::ai::AiSettings;
use crate::shared::bounded::Bounded;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const MAX_KEYBINDING_LEN: usize = 32;
const DEFAULT_TRASH_RETENTION_DAYS: u32 = 30;
const MAX_TRASH_RETENTION_DAYS: u32 = 3650;

pub const SIDEBAR_WIDTH_RANGE: Bounded = Bounded { min: 200.0, max: 420.0, default: 240.0 };
pub const CHAT_WIDTH_RANGE: Bounded = Bounded { min: 320.0, max: 720.0, default: 400.0 };
pub const BACKGROUND_BLUR_RANGE: Bounded = Bounded { min: 0.0, max: 10.0, default: 0.0 };
pub const BACKGROUND_OPACITY_RANGE: Bounded = Bounded { min: 0.05, max: 0.25, default: 0.1 };
pub const BACKGROUND_POSITION_RANGE: Bounded = Bounded { min: 0.0, max: 1.0, default: 0.5 };
pub const BACKGROUND_ZOOM_RANGE: Bounded = Bounded { min: 1.0, max: 3.0, default: 1.0 };

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundStyle {
    #[default]
    Image,
    Dither,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchEngine {
    #[default]
    Google,
    DuckDuckGo,
    Bing,
}

pub fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

pub fn is_keybinding(action: &str, hotkey: &str) -> bool {
    let valid_action =
        !action.is_empty() && action.len() <= MAX_KEYBINDING_LEN && action.bytes().all(|b| b.is_ascii_alphanumeric());
    valid_action && !hotkey.is_empty() && hotkey.len() <= MAX_KEYBINDING_LEN
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingGroup {
    General,
    Appearance,
    Keybindings,
    Trash,
    Ai,
    Other,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingBytes {
    pub key: String,
    pub group: SettingGroup,
    pub bytes: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub sidebar_open: bool,
    pub sidebar_width: f64,
    pub confirm_note_delete: bool,
    pub theme: Theme,
    pub accent_color: Option<String>,
    pub sidebar_color: Option<String>,
    pub panel_color: Option<String>,
    pub background_blur: f64,
    pub background_opacity: f64,
    pub background_style: BackgroundStyle,
    pub background_position_x: f64,
    pub background_position_y: f64,
    pub background_zoom: f64,
    pub keybindings: BTreeMap<String, String>,
    pub trash_retention_days: u32,
    pub media_folder_id: Option<i64>,
    pub search_engine: SearchEngine,
    pub mic_device: Option<String>,
    pub voice_model: Option<String>,
    pub hold_to_record: bool,
    pub voice_folder_id: Option<i64>,
    pub chat_open: bool,
    pub chat_width: f64,
    pub ai: AiSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            sidebar_open: true,
            sidebar_width: SIDEBAR_WIDTH_RANGE.default,
            confirm_note_delete: false,
            theme: Theme::default(),
            accent_color: None,
            sidebar_color: None,
            panel_color: None,
            background_blur: BACKGROUND_BLUR_RANGE.default,
            background_opacity: BACKGROUND_OPACITY_RANGE.default,
            background_style: BackgroundStyle::default(),
            background_position_x: BACKGROUND_POSITION_RANGE.default,
            background_position_y: BACKGROUND_POSITION_RANGE.default,
            background_zoom: BACKGROUND_ZOOM_RANGE.default,
            keybindings: BTreeMap::new(),
            trash_retention_days: DEFAULT_TRASH_RETENTION_DAYS,
            media_folder_id: None,
            search_engine: SearchEngine::default(),
            mic_device: None,
            voice_model: None,
            hold_to_record: true,
            voice_folder_id: None,
            chat_open: false,
            chat_width: CHAT_WIDTH_RANGE.default,
            ai: AiSettings::default(),
        }
    }
}

pub fn clamp_trash_retention(days: i64) -> u32 {
    u32::try_from(days.max(0)).unwrap_or(u32::MAX).min(MAX_TRASH_RETENTION_DAYS)
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct VoiceShortcutSettings {
    pub record: Option<String>,
    pub cancel: Option<String>,
    pub set_up: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trash_retention_stays_in_range() {
        assert_eq!(clamp_trash_retention(7), 7);
        assert_eq!(clamp_trash_retention(0), 0);
        assert_eq!(clamp_trash_retention(-5), 0);
        assert_eq!(clamp_trash_retention(99_999), MAX_TRASH_RETENTION_DAYS);
    }

    #[test]
    fn keybindings_are_validated() {
        assert!(is_keybinding("newNote", "mod+shift+n"));
        assert!(is_keybinding("openSettings", "mod++"));
        assert!(!is_keybinding("", "mod+n"));
        assert!(!is_keybinding("new.note", "mod+n"));
        assert!(!is_keybinding("newNote", ""));
        assert!(!is_keybinding("newNote", &"x".repeat(40)));
    }

    #[test]
    fn hex_colors_are_recognized() {
        assert!(is_hex_color("#7C3aed"));
        assert!(!is_hex_color("7c3aed"));
        assert!(!is_hex_color("#7c3ae"));
        assert!(!is_hex_color("#7c3aeg"));
    }
}
