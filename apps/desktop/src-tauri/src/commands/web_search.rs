use crate::features::web_search::{ImageResult, SearchResult, WebPage, WebSearch};
use crate::shared::error::Result;
use tauri::State;

const DEFAULT_LIMIT: usize = 6;

#[tauri::command]
pub async fn ai_search_images(
    web: State<'_, WebSearch>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<ImageResult>> {
    web.images(&query, limit.unwrap_or(DEFAULT_LIMIT)).await
}

#[tauri::command]
pub async fn ai_search_web(
    web: State<'_, WebSearch>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>> {
    web.search(&query, limit.unwrap_or(DEFAULT_LIMIT)).await
}

#[tauri::command]
pub async fn ai_read_web_page(web: State<'_, WebSearch>, url: String) -> Result<WebPage> {
    web.read_page(&url).await
}
