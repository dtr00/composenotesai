use super::{first_found, with_params, WebSearch};
use crate::shared::error::{Error, Result};
use crate::shared::html::{plain_text, Token, Tokens};
use crate::shared::web::is_http;
use serde::Serialize;
use serde_json::Value;
use tauri::Url;

const DUCKDUCKGO: &str = "https://html.duckduckgo.com/html/";
const WIKIPEDIA_API: &str = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_PAGES: &str = "https://en.wikipedia.org/wiki/";
const MAX_RESULTS: usize = 10;
const RESULT_LINK: &str = "result__a";
const RESULT_SNIPPET: &str = "result__snippet";

#[derive(Debug, Serialize, PartialEq)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

fn result_url(href: String) -> Option<String> {
    let link = Url::parse(&if href.starts_with("//") { format!("https:{href}") } else { href }).ok()?;
    let target = if link.path() == "/l/" {
        let (_, target) = link.query_pairs().find(|(key, _)| key == "uddg")?;
        Url::parse(&target).ok()?
    } else {
        link
    };
    let external = is_http(&target) && !target.host_str()?.ends_with("duckduckgo.com");
    external.then(|| target.to_string())
}

fn parse_duckduckgo(html: &str, limit: usize) -> Vec<SearchResult> {
    let mut found: Vec<Option<SearchResult>> = Vec::new();
    let mut tokens = Tokens::new(html);
    while let Some(token) = tokens.next() {
        let Token::Tag(tag) = token else { continue };
        if !tag.is_opening() || tag.name() != "a" {
            continue;
        }
        match tag.attribute("class").as_deref() {
            Some(RESULT_LINK) => {
                let url = tag.attribute("href").and_then(result_url);
                let title = plain_text(tokens.text_until_closing("a"));
                found.push(url.map(|url| SearchResult { title, url, snippet: String::new() }));
            }
            Some(RESULT_SNIPPET) => {
                if let Some(Some(result)) = found.last_mut() {
                    result.snippet = plain_text(tokens.text_until_closing("a"));
                }
            }
            _ => {}
        }
    }
    found.into_iter().flatten().take(limit).collect()
}

fn parse_wikipedia(json: &Value) -> Vec<SearchResult> {
    let pages = json["query"]["search"].as_array().map(Vec::as_slice).unwrap_or_default();
    let base = Url::parse(WIKIPEDIA_PAGES).ok();
    pages
        .iter()
        .filter_map(|page| {
            let title = page["title"].as_str()?;
            let url = base.as_ref()?.join(&title.replace(' ', "_")).ok()?;
            Some(SearchResult {
                title: title.to_owned(),
                url: url.to_string(),
                snippet: plain_text(page["snippet"].as_str().unwrap_or_default()),
            })
        })
        .collect()
}

impl WebSearch {
    async fn duckduckgo(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let html = self.get(with_params(DUCKDUCKGO, &[("q", query)])?).await?.text().await?;
        Ok(parse_duckduckgo(&html, limit))
    }

    async fn wikipedia(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let limit = limit.to_string();
        let params =
            [("action", "query"), ("format", "json"), ("list", "search"), ("srsearch", query), ("srlimit", &limit)];
        Ok(parse_wikipedia(&self.json(WIKIPEDIA_API, &params).await?))
    }

    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let query = query.trim();
        if query.is_empty() {
            return Err(Error::Message("Say what to search for.".into()));
        }
        let limit = limit.clamp(1, MAX_RESULTS);
        first_found(self.duckduckgo(query, limit).await, self.wikipedia(query, limit)).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const PAGE: &str = r#"
        <div class="result results_links"><h2 class="result__title">
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2F&amp;rut=abc">Tauri 2.0 | Tauri</a></h2>
          <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2F">Build <b>tiny</b> apps &amp; more</a></div>
        <div class="result result--ad"><a class="result__a" href="https://duckduckgo.com/y.js?ad_domain=x">Ad</a></div>
        <div class="result"><a class="result__a" href="https://github.com/tauri-apps/tauri">tauri-apps/tauri</a></div>"#;

    #[test]
    fn reads_duckduckgo_results_and_skips_ads() {
        let found = parse_duckduckgo(PAGE, 10);
        assert_eq!(
            found,
            vec![
                SearchResult {
                    title: "Tauri 2.0 | Tauri".into(),
                    url: "https://tauri.app/".into(),
                    snippet: "Build tiny apps & more".into()
                },
                SearchResult {
                    title: "tauri-apps/tauri".into(),
                    url: "https://github.com/tauri-apps/tauri".into(),
                    snippet: String::new()
                },
            ]
        );
        assert_eq!(parse_duckduckgo(PAGE, 1).len(), 1);
        assert!(parse_duckduckgo("<html>no results</html>", 5).is_empty());
    }

    #[test]
    fn reads_wikipedia_results() {
        let found = parse_wikipedia(&json!({ "query": { "search": [
            { "title": "Red fox", "snippet": "The <span class=\"searchmatch\">red</span> fox" }
        ]}}));
        assert_eq!(found[0].url, "https://en.wikipedia.org/wiki/Red_fox");
        assert_eq!(found[0].snippet, "The red fox");
    }

    #[test]
    #[ignore = "needs the internet"]
    fn searches_the_web() {
        crate::shared::testing::install_tls();
        let search = WebSearch::new().unwrap();
        let found = tauri::async_runtime::block_on(search.search("tauri framework", 5)).unwrap();
        assert!(!found.is_empty());
        assert!(found.iter().all(|result| result.url.starts_with("http")));
    }
}
