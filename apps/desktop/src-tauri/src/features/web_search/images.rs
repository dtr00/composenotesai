use super::{first_found, text, WebSearch};
use crate::shared::error::{Error, Result};
use crate::shared::html::plain_text;
use serde::Serialize;
use serde_json::Value;

const OPENVERSE: &str = "https://api.openverse.org/v1/images/";
const COMMONS: &str = "https://commons.wikimedia.org/w/api.php";
const MAX_RESULTS: usize = 10;
const COMMONS_WIDTH: &str = "1024";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageResult {
    pub title: String,
    pub url: String,
    pub width: Option<u64>,
    pub height: Option<u64>,
    pub creator: Option<String>,
    pub license: Option<String>,
    pub source: String,
    pub page: Option<String>,
}

fn license_label(code: &str, version: Option<&str>) -> String {
    match code {
        "cc0" => "CC0".into(),
        "pdm" => "Public domain".into(),
        code => {
            let name = format!("CC {}", code.to_uppercase());
            match version {
                Some(version) => format!("{name} {version}"),
                None => name,
            }
        }
    }
}

fn parse_openverse(json: &Value) -> Vec<ImageResult> {
    let results = json["results"].as_array().map(Vec::as_slice).unwrap_or_default();
    results
        .iter()
        .filter_map(|item| {
            let url = text(&item["url"])?;
            Some(ImageResult {
                title: text(&item["title"]).unwrap_or_else(|| "Untitled image".into()),
                url,
                width: item["width"].as_u64(),
                height: item["height"].as_u64(),
                creator: text(&item["creator"]),
                license: text(&item["license"]).map(|code| license_label(&code, item["license_version"].as_str())),
                source: text(&item["source"]).or_else(|| text(&item["provider"])).unwrap_or_else(|| "Openverse".into()),
                page: text(&item["foreign_landing_url"]),
            })
        })
        .collect()
}

fn commons_title(page_title: &str) -> String {
    let name = page_title.strip_prefix("File:").unwrap_or(page_title);
    name.rsplit_once('.').map_or(name, |(stem, _)| stem).replace('_', " ")
}

fn parse_commons(json: &Value) -> Vec<ImageResult> {
    let Some(pages) = json["query"]["pages"].as_object() else { return Vec::new() };
    let mut pages: Vec<&Value> = pages.values().collect();
    pages.sort_by_key(|page| page["index"].as_u64().unwrap_or(u64::MAX));
    pages
        .into_iter()
        .filter_map(|page| {
            let info = &page["imageinfo"][0];
            let url = text(&info["thumburl"]).or_else(|| text(&info["url"]))?;
            let meta = &info["extmetadata"];
            Some(ImageResult {
                title: commons_title(page["title"].as_str().unwrap_or_default()),
                url,
                width: info["thumbwidth"].as_u64().or_else(|| info["width"].as_u64()),
                height: info["thumbheight"].as_u64().or_else(|| info["height"].as_u64()),
                creator: meta["Artist"]["value"].as_str().map(plain_text).filter(|creator| !creator.is_empty()),
                license: text(&meta["LicenseShortName"]["value"]),
                source: "Wikimedia Commons".into(),
                page: text(&info["descriptionurl"]),
            })
        })
        .collect()
}

impl WebSearch {
    async fn openverse(&self, query: &str, limit: &str) -> Result<Vec<ImageResult>> {
        let json = self.json(OPENVERSE, &[("q", query), ("page_size", limit), ("mature", "false")]).await?;
        Ok(parse_openverse(&json))
    }

    async fn commons(&self, query: &str, limit: &str) -> Result<Vec<ImageResult>> {
        let search = format!("filetype:bitmap|drawing {query}");
        let params = [
            ("action", "query"),
            ("format", "json"),
            ("generator", "search"),
            ("gsrnamespace", "6"),
            ("gsrsearch", search.as_str()),
            ("gsrlimit", limit),
            ("prop", "imageinfo"),
            ("iiprop", "url|size|extmetadata"),
            ("iiurlwidth", COMMONS_WIDTH),
        ];
        Ok(parse_commons(&self.json(COMMONS, &params).await?))
    }

    pub async fn images(&self, query: &str, limit: usize) -> Result<Vec<ImageResult>> {
        let query = query.trim();
        if query.is_empty() {
            return Err(Error::Message("Say what to search images for.".into()));
        }
        let limit = limit.clamp(1, MAX_RESULTS).to_string();
        first_found(self.openverse(query, &limit).await, self.commons(query, &limit)).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_openverse_results() {
        let found = parse_openverse(&json!({ "results": [
            { "title": "Red fox", "url": "https://live.staticflickr.com/fox.jpg", "width": 1600, "height": 1067,
              "creator": "Jane", "license": "by-sa", "license_version": "2.0", "source": "flickr",
              "foreign_landing_url": "https://flickr.com/photos/1" },
            { "title": "No link" },
            { "url": "https://example.com/a.png", "license": "cc0", "provider": "wikimedia" }
        ]}));
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].license.as_deref(), Some("CC BY-SA 2.0"));
        assert_eq!(found[0].source, "flickr");
        assert_eq!(found[1].title, "Untitled image");
        assert_eq!(found[1].license.as_deref(), Some("CC0"));
        assert_eq!(found[1].source, "wikimedia");
    }

    #[test]
    fn reads_commons_results_in_search_order() {
        let found = parse_commons(&json!({ "query": { "pages": {
            "22": { "index": 2, "title": "File:Second_one.png", "imageinfo": [{ "url": "https://u/2.png" }] },
            "11": { "index": 1, "title": "File:Red_fox_(Vulpes).jpg", "imageinfo": [{
                "thumburl": "https://u/1024px-fox.jpg", "thumbwidth": 1024, "thumbheight": 683,
                "descriptionurl": "https://commons.wikimedia.org/wiki/File:Red_fox.jpg",
                "extmetadata": { "Artist": { "value": "<a href=\"x\">Some  Body</a>" },
                                 "LicenseShortName": { "value": "CC BY 4.0" } } }] }
        }}}));
        assert_eq!(found[0].title, "Red fox (Vulpes)");
        assert_eq!(found[0].url, "https://u/1024px-fox.jpg");
        assert_eq!(found[0].width, Some(1024));
        assert_eq!(found[0].creator.as_deref(), Some("Some Body"));
        assert_eq!(found[1].title, "Second one");
        assert!(parse_commons(&json!({})).is_empty());
    }

    #[test]
    #[ignore = "needs the internet"]
    fn searches_the_web() {
        crate::shared::testing::install_tls();
        let search = WebSearch::new().unwrap();
        let found = tauri::async_runtime::block_on(search.images("red fox", 3)).unwrap();
        assert!(!found.is_empty());
        assert!(found.iter().all(|image| image.url.starts_with("https://")));
    }
}
