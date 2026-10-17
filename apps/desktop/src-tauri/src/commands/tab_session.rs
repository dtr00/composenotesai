use crate::features::tab_session::{TabSession, TabSessionStore};
use crate::shared::error::Result;
use tauri::State;

#[tauri::command]
pub fn load_tab_session(store: State<TabSessionStore>) -> Result<TabSession> {
    store.load()
}

#[tauri::command]
pub fn save_tab_session(store: State<TabSessionStore>, session: TabSession) -> Result<()> {
    store.save(&session)
}
