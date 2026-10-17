use crate::features::link_preview::{LinkPreview, LinkPreviews};
use crate::shared::error::Result;
use tauri::State;

#[tauri::command]
pub async fn link_preview(previews: State<'_, LinkPreviews>, url: String) -> Result<LinkPreview> {
    previews.load(&url).await
}
