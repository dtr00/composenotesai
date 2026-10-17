use super::model::{
    clamp_trash_retention, is_hex_color, is_keybinding, SettingBytes, SettingGroup, Settings, VoiceShortcutSettings,
    BACKGROUND_BLUR_RANGE, BACKGROUND_OPACITY_RANGE, BACKGROUND_POSITION_RANGE, BACKGROUND_ZOOM_RANGE,
    CHAT_WIDTH_RANGE, SIDEBAR_WIDTH_RANGE,
};
#[cfg(test)]
use super::schema::CREATE_SETTINGS_TABLE;
use crate::entities::ai::AiSettings;
use crate::shared::bounded::Bounded;
#[cfg(test)]
use crate::shared::db::Migration;
use crate::shared::error::Result;
use crate::shared::lock::Lock;
use rusqlite::types::FromSql;
use rusqlite::{params, Connection, OptionalExtension, ToSql};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Copy)]
struct Key {
    name: &'static str,
    group: SettingGroup,
}

const fn key(name: &'static str, group: SettingGroup) -> Key {
    Key { name, group }
}

const SIDEBAR_OPEN: Key = key("sidebar_open", SettingGroup::General);
const SIDEBAR_WIDTH: Key = key("sidebar_width", SettingGroup::General);
const CONFIRM_NOTE_DELETE: Key = key("confirm_note_delete", SettingGroup::General);
const MEDIA_FOLDER_ID: Key = key("media_folder_id", SettingGroup::General);
const SEARCH_ENGINE: Key = key("search_engine", SettingGroup::General);
const MIC_DEVICE: Key = key("mic_device", SettingGroup::General);
const VOICE_MODEL: Key = key("voice_model", SettingGroup::General);
const RECORD_SHORTCUT: Key = key("record_shortcut", SettingGroup::General);
const CANCEL_SHORTCUT: Key = key("cancel_shortcut", SettingGroup::General);
const HOLD_TO_RECORD: Key = key("hold_to_record", SettingGroup::General);
const VOICE_FOLDER_ID: Key = key("voice_folder_id", SettingGroup::General);
const VOICE_SHORTCUTS_SET_UP: Key = key("record_shortcut_set_up", SettingGroup::General);
const THEME: Key = key("theme", SettingGroup::Appearance);
const ACCENT_COLOR: Key = key("accent_color", SettingGroup::Appearance);
const SIDEBAR_COLOR: Key = key("sidebar_color", SettingGroup::Appearance);
const PANEL_COLOR: Key = key("panel_color", SettingGroup::Appearance);
const BACKGROUND_BLUR: Key = key("background_blur", SettingGroup::Appearance);
const BACKGROUND_OPACITY: Key = key("background_opacity", SettingGroup::Appearance);
const BACKGROUND_STYLE: Key = key("background_style", SettingGroup::Appearance);
const BACKGROUND_POSITION_X: Key = key("background_position_x", SettingGroup::Appearance);
const BACKGROUND_POSITION_Y: Key = key("background_position_y", SettingGroup::Appearance);
const BACKGROUND_ZOOM: Key = key("background_zoom", SettingGroup::Appearance);
const TRASH_RETENTION_DAYS: Key = key("trash_retention_days", SettingGroup::Trash);
const CHAT_OPEN: Key = key("chat_open", SettingGroup::General);
const CHAT_WIDTH: Key = key("chat_width", SettingGroup::General);
const AI: Key = key("ai", SettingGroup::Ai);
const UNREADABLE_AI: Key = key("ai_unreadable", SettingGroup::Ai);
const KEYBINDING_PREFIX: &str = "keybinding.";

const KEYS: &[Key] = &[
    SIDEBAR_OPEN,
    SIDEBAR_WIDTH,
    CONFIRM_NOTE_DELETE,
    MEDIA_FOLDER_ID,
    SEARCH_ENGINE,
    MIC_DEVICE,
    VOICE_MODEL,
    RECORD_SHORTCUT,
    CANCEL_SHORTCUT,
    HOLD_TO_RECORD,
    VOICE_FOLDER_ID,
    VOICE_SHORTCUTS_SET_UP,
    THEME,
    ACCENT_COLOR,
    SIDEBAR_COLOR,
    PANEL_COLOR,
    BACKGROUND_BLUR,
    BACKGROUND_OPACITY,
    BACKGROUND_STYLE,
    BACKGROUND_POSITION_X,
    BACKGROUND_POSITION_Y,
    BACKGROUND_ZOOM,
    TRASH_RETENTION_DAYS,
    CHAT_OPEN,
    CHAT_WIDTH,
    AI,
    UNREADABLE_AI,
];

pub struct SettingsStore {
    conn: Lock<Connection>,
}

fn get<T: FromSql>(conn: &Connection, key: Key) -> Result<Option<T>> {
    Ok(conn.query_row("SELECT value FROM settings WHERE key = ?1", [key.name], |r| r.get(0)).optional()?)
}

fn upsert(conn: &Connection, name: &str, value: impl ToSql) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![name, value],
    )?;
    Ok(())
}

fn set(conn: &Connection, key: Key, value: impl ToSql) -> Result<()> {
    upsert(conn, key.name, value)
}

fn get_choice<T: DeserializeOwned>(conn: &Connection, key: Key) -> Result<Option<T>> {
    Ok(get::<String>(conn, key)?.and_then(|name| serde_json::from_value(Value::String(name)).ok()))
}

fn set_choice(conn: &Connection, key: Key, choice: impl Serialize) -> Result<()> {
    set(conn, key, serde_json::to_value(choice)?.as_str())
}

fn group(name: &str) -> SettingGroup {
    if name.starts_with(KEYBINDING_PREFIX) {
        return SettingGroup::Keybindings;
    }
    KEYS.iter().find(|key| key.name == name).map_or(SettingGroup::Other, |key| key.group)
}

fn get_bounded(conn: &Connection, key: Key, range: Bounded) -> Result<f64> {
    Ok(get(conn, key)?.map_or(range.default, |value| range.clamp(value)))
}

fn remove(conn: &Connection, key: Key) -> Result<()> {
    conn.execute("DELETE FROM settings WHERE key = ?1", [key.name])?;
    Ok(())
}

fn get_keybindings(conn: &Connection) -> Result<BTreeMap<String, String>> {
    let mut statement = conn.prepare("SELECT key, value FROM settings WHERE key LIKE 'keybinding.%'")?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    let mut keybindings = BTreeMap::new();
    for row in rows {
        let (key, hotkey) = row?;
        if let Some(action) = key.strip_prefix(KEYBINDING_PREFIX).filter(|action| is_keybinding(action, &hotkey)) {
            keybindings.insert(action.to_owned(), hotkey);
        }
    }
    Ok(keybindings)
}

fn set_keybindings(conn: &Connection, keybindings: &BTreeMap<String, String>) -> Result<()> {
    conn.execute("DELETE FROM settings WHERE key LIKE 'keybinding.%'", [])?;
    for (action, hotkey) in keybindings.iter().filter(|(action, hotkey)| is_keybinding(action, hotkey)) {
        upsert(conn, &format!("{KEYBINDING_PREFIX}{action}"), hotkey)?;
    }
    Ok(())
}

fn get_ai(conn: &Connection) -> Result<AiSettings> {
    let Some(json) = get::<String>(conn, AI)? else { return Ok(AiSettings::default()) };
    match serde_json::from_str::<AiSettings>(&json) {
        Ok(parsed) => Ok(parsed.sanitized()),
        Err(error) => {
            keep_unreadable_ai(conn, &json, &error)?;
            Ok(AiSettings::default())
        }
    }
}

fn keep_unreadable_ai(conn: &Connection, json: &str, error: &serde_json::Error) -> Result<()> {
    if get::<String>(conn, UNREADABLE_AI)?.as_deref() != Some(json) {
        set(conn, UNREADABLE_AI, json)?;
        eprintln!("[settings] AI settings were unreadable ({error}), so a copy was kept as {}", UNREADABLE_AI.name);
    }
    Ok(())
}

fn get_color(conn: &Connection, key: Key) -> Result<Option<String>> {
    Ok(get::<String>(conn, key)?.filter(|color| is_hex_color(color)))
}

fn set_optional(conn: &Connection, key: Key, value: Option<impl ToSql>) -> Result<()> {
    match value {
        Some(value) => set(conn, key, value),
        None => remove(conn, key),
    }
}

impl SettingsStore {
    pub fn new(conn: Connection) -> Self {
        Self { conn: Lock::new(conn) }
    }

    #[cfg(test)]
    fn open_in_memory() -> Result<Self> {
        Ok(Self::new(crate::shared::db::open_in_memory(&[Migration::Sql(CREATE_SETTINGS_TABLE)])?))
    }

    pub fn stored_bytes(&self) -> Result<Vec<SettingBytes>> {
        let conn = self.conn.lock();
        let mut stmt =
            conn.prepare("SELECT key, length(CAST(key AS BLOB)) + length(CAST(value AS BLOB)) FROM settings")?;
        let rows = stmt.query_map([], |r| {
            let key: String = r.get(0)?;
            Ok(SettingBytes { group: group(&key), key, bytes: r.get::<_, i64>(1)?.unsigned_abs() })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn load(&self) -> Result<Settings> {
        let conn = self.conn.lock();
        let defaults = Settings::default();
        Ok(Settings {
            sidebar_open: get(&conn, SIDEBAR_OPEN)?.unwrap_or(defaults.sidebar_open),
            sidebar_width: get_bounded(&conn, SIDEBAR_WIDTH, SIDEBAR_WIDTH_RANGE)?,
            confirm_note_delete: get(&conn, CONFIRM_NOTE_DELETE)?.unwrap_or(defaults.confirm_note_delete),
            theme: get_choice(&conn, THEME)?.unwrap_or(defaults.theme),
            accent_color: get_color(&conn, ACCENT_COLOR)?,
            sidebar_color: get_color(&conn, SIDEBAR_COLOR)?,
            panel_color: get_color(&conn, PANEL_COLOR)?,
            background_blur: get_bounded(&conn, BACKGROUND_BLUR, BACKGROUND_BLUR_RANGE)?,
            background_opacity: get_bounded(&conn, BACKGROUND_OPACITY, BACKGROUND_OPACITY_RANGE)?,
            background_style: get_choice(&conn, BACKGROUND_STYLE)?.unwrap_or(defaults.background_style),
            background_position_x: get_bounded(&conn, BACKGROUND_POSITION_X, BACKGROUND_POSITION_RANGE)?,
            background_position_y: get_bounded(&conn, BACKGROUND_POSITION_Y, BACKGROUND_POSITION_RANGE)?,
            background_zoom: get_bounded(&conn, BACKGROUND_ZOOM, BACKGROUND_ZOOM_RANGE)?,
            keybindings: get_keybindings(&conn)?,
            trash_retention_days: get(&conn, TRASH_RETENTION_DAYS)?
                .map_or(defaults.trash_retention_days, clamp_trash_retention),
            media_folder_id: get(&conn, MEDIA_FOLDER_ID)?,
            search_engine: get_choice(&conn, SEARCH_ENGINE)?.unwrap_or(defaults.search_engine),
            mic_device: get(&conn, MIC_DEVICE)?,
            voice_model: get(&conn, VOICE_MODEL)?,
            hold_to_record: get(&conn, HOLD_TO_RECORD)?.unwrap_or(defaults.hold_to_record),
            voice_folder_id: get(&conn, VOICE_FOLDER_ID)?,
            chat_open: get(&conn, CHAT_OPEN)?.unwrap_or(defaults.chat_open),
            chat_width: get_bounded(&conn, CHAT_WIDTH, CHAT_WIDTH_RANGE)?,
            ai: get_ai(&conn)?,
        })
    }

    pub fn voice_shortcuts(&self) -> Result<VoiceShortcutSettings> {
        let conn = self.conn.lock();
        Ok(VoiceShortcutSettings {
            record: get(&conn, RECORD_SHORTCUT)?,
            cancel: get(&conn, CANCEL_SHORTCUT)?,
            set_up: get(&conn, VOICE_SHORTCUTS_SET_UP)?.unwrap_or(false),
        })
    }

    pub fn save_voice_shortcuts(&self, shortcuts: &VoiceShortcutSettings) -> Result<()> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        set_optional(&tx, RECORD_SHORTCUT, shortcuts.record.as_deref())?;
        set_optional(&tx, CANCEL_SHORTCUT, shortcuts.cancel.as_deref())?;
        set(&tx, VOICE_SHORTCUTS_SET_UP, shortcuts.set_up)?;
        tx.commit()?;
        Ok(())
    }

    pub fn save(&self, settings: &Settings) -> Result<()> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        set(&tx, SIDEBAR_OPEN, settings.sidebar_open)?;
        set(&tx, SIDEBAR_WIDTH, SIDEBAR_WIDTH_RANGE.clamp(settings.sidebar_width))?;
        set(&tx, CONFIRM_NOTE_DELETE, settings.confirm_note_delete)?;
        set_choice(&tx, THEME, settings.theme)?;
        set(&tx, BACKGROUND_BLUR, BACKGROUND_BLUR_RANGE.clamp(settings.background_blur))?;
        set(&tx, BACKGROUND_OPACITY, BACKGROUND_OPACITY_RANGE.clamp(settings.background_opacity))?;
        set_choice(&tx, BACKGROUND_STYLE, settings.background_style)?;
        set(&tx, BACKGROUND_POSITION_X, BACKGROUND_POSITION_RANGE.clamp(settings.background_position_x))?;
        set(&tx, BACKGROUND_POSITION_Y, BACKGROUND_POSITION_RANGE.clamp(settings.background_position_y))?;
        set(&tx, BACKGROUND_ZOOM, BACKGROUND_ZOOM_RANGE.clamp(settings.background_zoom))?;
        set_optional(&tx, ACCENT_COLOR, settings.accent_color.as_deref())?;
        set_optional(&tx, SIDEBAR_COLOR, settings.sidebar_color.as_deref())?;
        set_optional(&tx, PANEL_COLOR, settings.panel_color.as_deref())?;
        set_keybindings(&tx, &settings.keybindings)?;
        set(&tx, TRASH_RETENTION_DAYS, settings.trash_retention_days)?;
        set_optional(&tx, MEDIA_FOLDER_ID, settings.media_folder_id)?;
        set_choice(&tx, SEARCH_ENGINE, settings.search_engine)?;
        set_optional(&tx, MIC_DEVICE, settings.mic_device.as_deref())?;
        set_optional(&tx, VOICE_MODEL, settings.voice_model.as_deref())?;
        set(&tx, HOLD_TO_RECORD, settings.hold_to_record)?;
        set_optional(&tx, VOICE_FOLDER_ID, settings.voice_folder_id)?;
        set(&tx, CHAT_OPEN, settings.chat_open)?;
        set(&tx, CHAT_WIDTH, CHAT_WIDTH_RANGE.clamp(settings.chat_width))?;
        set(&tx, AI, serde_json::to_string(&settings.ai.clone().sanitized())?)?;
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::model::{BackgroundStyle, SearchEngine, Theme};
    use super::*;

    #[test]
    fn empty_store_loads_defaults() {
        let store = SettingsStore::open_in_memory().unwrap();
        assert_eq!(store.load().unwrap(), Settings::default());
    }

    #[test]
    fn saved_settings_load_back() {
        let store = SettingsStore::open_in_memory().unwrap();
        let changed = Settings {
            sidebar_open: false,
            sidebar_width: 320.0,
            confirm_note_delete: true,
            theme: Theme::Light,
            accent_color: Some("#7c3aed".into()),
            sidebar_color: Some("#f4f4f5".into()),
            panel_color: Some("#18181b".into()),
            background_blur: 6.0,
            background_opacity: 0.15,
            background_style: BackgroundStyle::Dither,
            background_position_x: 0.25,
            background_position_y: 0.75,
            background_zoom: 2.0,
            keybindings: BTreeMap::from([("newNote".into(), "mod+shift+n".into())]),
            trash_retention_days: 7,
            media_folder_id: Some(3),
            search_engine: SearchEngine::Bing,
            mic_device: Some("alsa:default".into()),
            voice_model: Some("small".into()),
            hold_to_record: false,
            voice_folder_id: Some(4),
            chat_open: true,
            chat_width: 480.0,
            ai: AiSettings { temperature: 0.3, thinking: true, ..AiSettings::default() },
        };
        store.save(&changed).unwrap();
        assert_eq!(store.load().unwrap(), changed);
        store.save(&Settings::default()).unwrap();
        assert_eq!(store.load().unwrap(), Settings::default());
    }

    #[test]
    fn stored_bytes_grow_with_saved_settings() {
        let store = SettingsStore::open_in_memory().unwrap();
        assert!(store.stored_bytes().unwrap().is_empty());
        store.save(&Settings::default()).unwrap();
        let theme = store.stored_bytes().unwrap().into_iter().find(|row| row.key == THEME.name).unwrap();
        assert_eq!(theme.bytes, (THEME.name.len() + "system".len()) as u64);
        assert_eq!(theme.group, SettingGroup::Appearance);
        assert_eq!(group("keybinding.newNote"), SettingGroup::Keybindings);
        assert_eq!(group(TRASH_RETENTION_DAYS.name), SettingGroup::Trash);
        assert_eq!(group(SIDEBAR_OPEN.name), SettingGroup::General);
        assert_eq!(group("legacy"), SettingGroup::Other);
    }

    #[test]
    fn every_key_is_saved_under_a_known_group() {
        let store = SettingsStore::open_in_memory().unwrap();
        set(&store.conn.lock(), AI, "{not json").unwrap();
        store.load().unwrap();
        let color = Some("#7c3aed".to_owned());
        store
            .save(&Settings {
                accent_color: color.clone(),
                sidebar_color: color.clone(),
                panel_color: color,
                keybindings: BTreeMap::from([("newNote".into(), "mod+shift+n".into())]),
                media_folder_id: Some(1),
                mic_device: Some("alsa:default".into()),
                voice_model: Some("small".into()),
                voice_folder_id: Some(2),
                ..Settings::default()
            })
            .unwrap();
        let shortcut = Some("mod+shift+r".to_owned());
        let shortcuts = VoiceShortcutSettings { record: shortcut.clone(), cancel: shortcut, set_up: true };
        store.save_voice_shortcuts(&shortcuts).unwrap();
        let rows = store.stored_bytes().unwrap();
        assert!(rows.iter().all(|row| row.group != SettingGroup::Other));
        assert!(KEYS.iter().all(|key| rows.iter().any(|row| row.key == key.name)));
    }

    #[test]
    fn voice_shortcuts_survive_saving_settings() {
        let store = SettingsStore::open_in_memory().unwrap();
        assert_eq!(store.voice_shortcuts().unwrap(), VoiceShortcutSettings::default());
        let shortcuts = VoiceShortcutSettings {
            record: Some("mod+shift+r".into()),
            cancel: Some("mod+shift+x".into()),
            set_up: true,
        };
        store.save_voice_shortcuts(&shortcuts).unwrap();
        store.save(&Settings::default()).unwrap();
        assert_eq!(store.voice_shortcuts().unwrap(), shortcuts);
        store.save_voice_shortcuts(&VoiceShortcutSettings { record: None, ..shortcuts }).unwrap();
        assert_eq!(store.voice_shortcuts().unwrap().record, None);
    }

    #[test]
    fn voice_shortcuts_saved_by_earlier_builds_still_load() {
        let store = SettingsStore::open_in_memory().unwrap();
        upsert(&store.conn.lock(), "record_shortcut", "mod+shift+r").unwrap();
        upsert(&store.conn.lock(), "record_shortcut_set_up", true).unwrap();
        let shortcuts = store.voice_shortcuts().unwrap();
        assert_eq!(shortcuts.record.as_deref(), Some("mod+shift+r"));
        assert!(shortcuts.set_up);
    }

    #[test]
    fn unknown_theme_loads_default() {
        let store = SettingsStore::open_in_memory().unwrap();
        set(&store.conn.lock(), THEME, "sepia").unwrap();
        assert_eq!(store.load().unwrap().theme, Theme::default());
    }

    #[test]
    fn sidebar_width_stays_within_its_range() {
        let store = SettingsStore::open_in_memory().unwrap();
        store.save(&Settings { sidebar_width: 2000.0, ..Settings::default() }).unwrap();
        assert_eq!(store.load().unwrap().sidebar_width, 420.0);
        set(&store.conn.lock(), SIDEBAR_WIDTH, 12.0).unwrap();
        assert_eq!(store.load().unwrap().sidebar_width, 200.0);
    }

    #[test]
    fn malformed_accent_color_loads_default() {
        let store = SettingsStore::open_in_memory().unwrap();
        set(&store.conn.lock(), ACCENT_COLOR, "blue").unwrap();
        set(&store.conn.lock(), PANEL_COLOR, "#12345").unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.accent_color, None);
        assert_eq!(loaded.panel_color, None);
    }

    #[test]
    fn unreadable_ai_settings_are_kept_when_defaults_are_saved_over_them() {
        let store = SettingsStore::open_in_memory().unwrap();
        set(&store.conn.lock(), AI, "{not json").unwrap();
        assert_eq!(store.load().unwrap().ai, AiSettings::default());
        store.save(&Settings::default()).unwrap();
        assert_eq!(get::<String>(&store.conn.lock(), UNREADABLE_AI).unwrap().as_deref(), Some("{not json"));
    }

    #[test]
    fn reopening_keeps_settings() {
        let dir = crate::shared::testing::temp_dir("settings-reopen");
        let path = dir.join(crate::shared::db::DATABASE_FILE);
        let migrations = [Migration::Sql(CREATE_SETTINGS_TABLE)];
        let open = || SettingsStore::new(crate::shared::db::open(&path, &migrations).unwrap());
        open()
            .save(&Settings {
                sidebar_open: false,
                sidebar_width: 300.0,
                confirm_note_delete: true,
                theme: Theme::Dark,
                accent_color: Some("#16a34a".into()),
                sidebar_color: Some("#27272a".into()),
                panel_color: None,
                background_blur: 4.0,
                background_opacity: 0.1,
                background_style: BackgroundStyle::Dither,
                background_position_x: 0.25,
                background_position_y: 0.75,
                background_zoom: 1.5,
                keybindings: BTreeMap::from([("openSettings".into(), "alt+,".into())]),
                trash_retention_days: 0,
                media_folder_id: Some(5),
                search_engine: SearchEngine::DuckDuckGo,
                mic_device: None,
                voice_model: None,
                hold_to_record: false,
                voice_folder_id: None,
                ..Settings::default()
            })
            .unwrap();
        let reopened = open().load().unwrap();
        assert!(!reopened.sidebar_open && reopened.confirm_note_delete);
        assert_eq!(reopened.theme, Theme::Dark);
        assert_eq!(reopened.accent_color.as_deref(), Some("#16a34a"));
        assert_eq!(reopened.sidebar_color.as_deref(), Some("#27272a"));
        assert_eq!(reopened.panel_color, None);
        assert_eq!(reopened.background_blur, 4.0);
        assert_eq!(reopened.background_opacity, 0.1);
        assert_eq!(reopened.background_style, BackgroundStyle::Dither);
        assert_eq!((reopened.background_position_x, reopened.background_position_y), (0.25, 0.75));
        assert_eq!(reopened.background_zoom, 1.5);
        assert_eq!(reopened.trash_retention_days, 0);
        assert_eq!(reopened.media_folder_id, Some(5));
        assert_eq!(reopened.search_engine, SearchEngine::DuckDuckGo);
        assert_eq!(reopened.keybindings.get("openSettings").map(String::as_str), Some("alt+,"));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
