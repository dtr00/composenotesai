use super::WebSearch;
use crate::shared::error::{Error, Result};
use crate::shared::html::readable_text;
use crate::shared::web::get_public;
use serde::Serialize;

const MAX_PAGE_BYTES: usize = 3 << 20;
const MAX_TEXT_CHARS: usize = 15_000;
const ACCEPT: &str = "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebPage {
    pub url: String,
    pub title: Option<String>,
    pub text: String,
    pub truncated: bool,
}

fn cut(text: String) -> (String, bool) {
    match text.char_indices().nth(MAX_TEXT_CHARS) {
        Some((end, _)) => (text[..end].trim_end().to_owned(), true),
        None => (text, false),
    }
}

impl WebSearch {
    pub async fn read_page(&self, address: &str) -> Result<WebPage> {
        let page = get_public(&self.0, address, ACCEPT).await?;
        let html = page.is_html();
        let kind = page.content_type.as_deref().unwrap_or_default();
        if !html && !kind.starts_with("text/") {
            return Err(Error::Message(format!("That link is a {kind} file, not a web page I can read.")));
        }
        let url = page.url.to_string();
        let body = page.read(MAX_PAGE_BYTES, |_| false).await?;
        let body = String::from_utf8_lossy(&body);
        let (title, text) = if html { readable_text(&body) } else { (None, body.trim().to_owned()) };
        let (text, truncated) = cut(text);
        Ok(WebPage { url, title, text, truncated })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_addresses_are_refused() {
        crate::shared::testing::install_tls();
        let search = WebSearch::new().unwrap();
        for address in ["http://localhost:11434/api/tags", "http://192.168.1.1/", "file:///etc/passwd", "nonsense"] {
            let error = tauri::async_runtime::block_on(search.read_page(address)).unwrap_err();
            assert!(error.to_string().contains("Only public web pages"), "{address}");
        }
    }

    #[test]
    fn long_pages_are_cut() {
        let (text, truncated) = cut("word ".repeat(5_000));
        assert!(truncated);
        assert!(text.chars().count() <= MAX_TEXT_CHARS);
        assert_eq!(cut("short".into()), ("short".into(), false));
    }

    #[test]
    #[ignore = "needs the internet"]
    fn reads_a_page() {
        crate::shared::testing::install_tls();
        let search = WebSearch::new().unwrap();
        let page = tauri::async_runtime::block_on(search.read_page("https://en.wikipedia.org/wiki/Red_fox")).unwrap();
        assert!(page.title.unwrap().contains("fox"));
        assert!(page.text.contains("Vulpes vulpes"));
    }
}
