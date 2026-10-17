mod images;
mod page;
mod search;

pub use images::ImageResult;
pub use page::WebPage;
pub use search::SearchResult;

use crate::shared::error::{Error, Result};
use crate::shared::web::public_client;
use serde_json::Value;
use std::future::Future;
use std::time::Duration;
use tauri::Url;

// Search pages refuse unknown clients, so this looks like a browser but still names the app.
const USER_AGENT: &str = concat!(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) ComposeNotesAI/",
    env!("CARGO_PKG_VERSION")
);
const TIMEOUT: Duration = Duration::from_secs(15);

pub struct WebSearch(reqwest::Client);

fn text(value: &Value) -> Option<String> {
    value.as_str().map(str::trim).filter(|text| !text.is_empty()).map(str::to_owned)
}

fn with_params(url: &str, params: &[(&str, &str)]) -> Result<Url> {
    Url::parse_with_params(url, params).map_err(|error| Error::Message(format!("The web request failed: {error}")))
}

async fn first_found<T>(primary: Result<Vec<T>>, fallback: impl Future<Output = Result<Vec<T>>>) -> Result<Vec<T>> {
    match primary {
        Ok(found) if !found.is_empty() => Ok(found),
        primary => match fallback.await {
            Ok(found) => Ok(found),
            Err(error) => primary.and(Err(error)),
        },
    }
}

impl WebSearch {
    pub fn new() -> Result<Self> {
        Ok(Self(public_client(USER_AGENT, TIMEOUT)?))
    }

    async fn get(&self, url: Url) -> Result<reqwest::Response> {
        Ok(self.0.get(url).send().await?.error_for_status()?)
    }

    async fn json(&self, url: &str, params: &[(&str, &str)]) -> Result<Value> {
        Ok(self.get(with_params(url, params)?).await?.json().await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(primary: Result<Vec<u8>>, fallback: Result<Vec<u8>>) -> std::result::Result<Vec<u8>, String> {
        tauri::async_runtime::block_on(first_found(primary, async { fallback })).map_err(|error| error.to_string())
    }

    #[test]
    fn falls_back_only_when_the_primary_finds_nothing_and_keeps_its_error() {
        let error = |message: &str| Err(Error::Message(message.into()));
        assert_eq!(found(Ok(vec![1]), error("unused")), Ok(vec![1]));
        assert_eq!(found(Ok(vec![]), Ok(vec![2])), Ok(vec![2]));
        assert_eq!(found(error("first"), Ok(vec![])), Ok(vec![]));
        assert_eq!(found(error("first"), error("second")), Err("first".into()));
        assert_eq!(found(Ok(vec![]), error("second")), Err("second".into()));
    }
}
