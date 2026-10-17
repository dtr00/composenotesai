use crate::commands::{
    ai, browser, chats, link_preview, links, media, notes, panel_background, settings, skills, storage, system,
    tab_session, updater, voice, web_search, windows,
};
use crate::features::ai::{Engine, LanguageModels};
use crate::features::browser::{self as browser_view, AppHotkeys};
use crate::features::chats::{ChatStore, CREATE_CHATS_TABLE};
use crate::features::link_preview::LinkPreviews;
use crate::features::notes::{
    NoteMedia, NoteStore, ADD_FOLDERS, ADD_LIVE_VIEWS, ADD_MEDIA, ADD_NOTE_FORMAT, ADD_TRASH, CREATE_NOTES_TABLE,
};
use crate::features::settings::{SettingsStore, CREATE_SETTINGS_TABLE};
use crate::features::skills::{SkillStore, CREATE_SKILLS_TABLE};
use crate::features::speech_models::SpeechModels;
use crate::features::storage::{engine_dir, language_model_dir, speech_model_dir};
use crate::features::system::SystemMonitor;
use crate::features::tab_session::{TabSessionStore, CREATE_TAB_GROUP_TABLES, CREATE_TAB_SESSION_TABLE};
use crate::features::voice::{Recorder, Transcriber, VoiceNote};
use crate::features::voice_shortcuts;
use crate::features::web_search::WebSearch;
use crate::features::windows::{
    build_voice_overlay, create_main_window, install_tray, keep_main_window_alive, show_main_window, OverlayProcess,
    OVERLAY_PROCESS_ARG,
};
use crate::shared::cancel::Registry;
use crate::shared::db::{
    self,
    Migration::{self, Sql},
};
use crate::shared::media_server;
use crate::shared::web;
use crate::shared::web_cache::clear_web_caches;
use tauri::Manager;

mod agent;
mod background;
mod browser_cache;

#[cfg(target_os = "macos")]
mod menu;

const MIGRATIONS: &[Migration] = &[
    Sql(CREATE_NOTES_TABLE),
    Sql(CREATE_SETTINGS_TABLE),
    Sql(ADD_FOLDERS),
    Sql(ADD_TRASH),
    Sql(ADD_LIVE_VIEWS),
    Sql(CREATE_TAB_GROUP_TABLES),
    Sql(ADD_MEDIA),
    Sql(CREATE_TAB_SESSION_TABLE),
    Sql(CREATE_SKILLS_TABLE),
    Sql(CREATE_CHATS_TABLE),
    ADD_MISSING_SKILLS_TABLE,
    ADD_NOTE_FORMAT,
];

const ADD_MISSING_SKILLS_TABLE: Migration = Sql(CREATE_SKILLS_TABLE);

pub fn run() {
    if std::env::args_os().any(|arg| arg == "--agent") {
        std::process::exit(agent::run());
    }
    let mut context = tauri::generate_context!();
    if cfg!(debug_assertions) {
        context.config_mut().identifier.push_str(".dev");
    }
    if std::env::args().any(|arg| arg == OVERLAY_PROCESS_ARG) {
        return run_voice_overlay(context);
    }
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _, _| show_main_window(app)));
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::macos_menu);
    let app = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let path = dir.join(db::DATABASE_FILE);
            if let Err(error) = db::enable_auto_vacuum(&path) {
                eprintln!("[storage] couldn't shrink the notes database: {error}");
            }
            let open = || db::open(&path, MIGRATIONS);
            let settings = SettingsStore::new(open()?);
            let notes = NoteStore::new(open()?)?;
            notes.purge_expired_trash(settings.load()?.trash_retention_days)?;
            app.manage(notes);
            app.manage(media::MediaBase(media_server::start(NoteMedia(app.handle().clone()))?));
            app.manage(settings);
            app.manage(TabSessionStore::new(open()?));
            app.manage(SystemMonitor::new());
            app.manage(Recorder::default());
            app.manage(Transcriber::default());
            app.manage(VoiceNote::default());
            app.manage(OverlayProcess::default());
            app.manage(AppHotkeys::default());
            let _ = rustls::crypto::ring::default_provider().install_default();
            app.manage(LinkPreviews::new()?);
            let client = web::client()?;
            app.manage(SpeechModels::new(speech_model_dir(&dir), client.clone()));
            app.manage(SkillStore::new(open()?));
            app.manage(ChatStore::new(open()?));
            app.manage(LanguageModels::new(language_model_dir(&dir), client.clone()));
            app.manage(Engine::new(engine_dir(&dir), client.clone()));
            app.manage(Registry::default());
            app.manage(client);
            app.manage(WebSearch::new()?);
            clear_web_caches(&[app.path().app_local_data_dir()?, browser_view::data_directory(app.handle())?]);
            create_main_window(app)?;
            install_tray(app)?;
            let saved = app.state::<SettingsStore>().voice_shortcuts()?;
            let (record, cancel) = (saved.record.as_deref(), saved.cancel.as_deref());
            voice_shortcuts::register(app, voice::on_shortcut, record, cancel, saved.set_up)?;
            background::watch_from_start(app.handle());
            browser_cache::clear_on_schedule(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            keep_main_window_alive(window, event);
            background::offload_models_in_background(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            notes::create_note,
            notes::create_folder,
            notes::list_entries,
            notes::load_note,
            notes::save_note,
            notes::rename_note,
            notes::duplicate_entry,
            notes::rename_folder,
            notes::set_folder_collapsed,
            notes::move_entries,
            notes::set_all_folders_collapsed,
            notes::trash_entries,
            notes::restore_trash,
            notes::list_trash,
            notes::delete_from_trash,
            notes::empty_trash,
            media::create_media,
            media::import_media,
            media::copied_files,
            media::media_config,
            media::rename_media,
            media::media_links,
            media::media_info,
            media::read_media,
            links::open_url,
            link_preview::link_preview,
            browser::browser_show,
            browser::browser_set_bounds,
            browser::browser_hide,
            browser::browser_reload,
            browser::browser_stop,
            browser::browser_close,
            browser::browser_close_all,
            browser::browser_clear_cache,
            browser::browser_set_hotkeys,
            settings::load_settings,
            settings::save_settings,
            storage::storage_usage,
            system::system_info,
            system::system_usage,
            tab_session::load_tab_session,
            tab_session::save_tab_session,
            updater::install_update,
            windows::open_window,
            windows::print_page,
            panel_background::load_panel_background,
            panel_background::save_panel_background,
            panel_background::clear_panel_background,
            voice::voice_note_state,
            voice::microphones,
            voice::voice_test_start,
            voice::voice_test_stop,
            voice::voice_dictation_start,
            voice::voice_dictation_stop,
            voice::voice_dictation_cancel,
            voice::voice_shortcuts,
            voice::set_voice_shortcut,
            voice::set_up_voice_shortcuts,
            voice::voice_models,
            voice::download_voice_model,
            voice::cancel_voice_model_download,
            voice::delete_voice_model,
            notes::search_notes,
            ai::ai_models,
            ai::ai_test_provider,
            ai::ai_chat,
            ai::ai_chat_cancel,
            ai::ai_engine,
            ai::ai_install_engine,
            ai::ai_cancel_engine_install,
            ai::ai_uninstall_engine,
            ai::ai_unload_model,
            ai::ai_local_models,
            ai::ai_download_model,
            ai::ai_download_model_url,
            ai::ai_cancel_model_download,
            ai::ai_delete_model,
            ai::ai_download_vision,
            ai::ai_cancel_vision_download,
            ai::ai_delete_vision,
            ai::ai_ollama_pull,
            ai::ai_ollama_cancel_pull,
            ai::ai_ollama_delete,
            web_search::ai_search_images,
            web_search::ai_search_web,
            web_search::ai_read_web_page,
            skills::list_skills,
            skills::load_skill,
            skills::find_skill,
            skills::install_skill,
            skills::install_skill_from_url,
            skills::save_skill,
            skills::set_skill_enabled,
            skills::delete_skill,
            chats::list_chats,
            chats::load_chat,
            chats::save_chat,
            chats::delete_chat,
            chats::read_chat_attachment,
            chats::read_chat_attachment_bytes,
        ])
        .build(context)
        .expect("error while building tauri application");
    app.run(|app, event| match event {
        tauri::RunEvent::Exit => app.state::<Engine>().stop(),
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show_main_window(app),
        _ => {}
    });
}

fn run_voice_overlay(context: tauri::Context) {
    tauri::Builder::default()
        .manage(voice::overlay::ParentSettings::from_parent())
        .manage(VoiceNote::default())
        .setup(|app| {
            build_voice_overlay(app.handle())?;
            voice::overlay::relay_from_parent(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![voice::overlay::parent_settings, voice::voice_note_state])
        .run(context)
        .expect("error while running the voice note overlay");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::db::{migrate, open_in_memory};
    use rusqlite::Connection;

    const MAIN_BUILD: usize = 8;
    const AI_BUILD: usize = 10;

    fn drawings_build() -> Vec<Migration> {
        MIGRATIONS[..MAIN_BUILD].iter().copied().chain([ADD_NOTE_FORMAT]).collect()
    }

    fn add_note(conn: &Connection, title: &str, format: &str) {
        let sql = "INSERT INTO notes (title, body, dict_id, created_at, updated_at) VALUES (?1, x'', 1, 0, 0)";
        conn.execute(sql, [title]).unwrap();
        if format != "markdown" {
            conn.execute("UPDATE notes SET format = ?1 WHERE title = ?2", [format, title]).unwrap();
        }
    }

    fn format_of(conn: &Connection, title: &str) -> String {
        conn.query_row("SELECT format FROM notes WHERE title = ?1", [title], |r| r.get(0)).unwrap()
    }

    #[test]
    fn databases_from_every_earlier_build_reach_the_current_schema() {
        let drawings = drawings_build();
        for earlier in [&MIGRATIONS[..MAIN_BUILD], &drawings, &MIGRATIONS[..AI_BUILD], MIGRATIONS] {
            let conn = open_in_memory(earlier).unwrap();
            add_note(&conn, "Kept", "markdown");
            migrate(&conn, MIGRATIONS).unwrap();
            let version: u32 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
            assert_eq!(version as usize, MIGRATIONS.len());
            assert!(conn.table_exists(None, "skills").unwrap() && conn.table_exists(None, "chats").unwrap());
            assert_eq!(format_of(&conn, "Kept"), "markdown");
        }
    }

    #[test]
    fn drawings_survive_the_upgrade_from_the_drawings_build() {
        let conn = open_in_memory(&drawings_build()).unwrap();
        add_note(&conn, "Sketch", "excalidraw");
        migrate(&conn, MIGRATIONS).unwrap();
        assert_eq!(format_of(&conn, "Sketch"), "excalidraw");
    }
}
