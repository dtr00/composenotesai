use crate::features::links;
use crate::shared::error::Result;

#[tauri::command]
pub fn open_url(url: String) -> Result<()> {
    links::open_url(&url)
}
