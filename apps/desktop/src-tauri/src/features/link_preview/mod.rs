mod head;

use crate::shared::error::Result;
use crate::shared::web::{get_public, public_client, SAFARI_USER_AGENT};
use serde::Serialize;
use std::time::Duration;

const MAX_HEAD_BYTES: usize = 512 * 1024;
const TIMEOUT: Duration = Duration::from_secs(8);
const HEAD_END: &[u8] = b"</head>";
const HTML: &str = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    title: Option<String>,
    description: Option<String>,
    image: Option<String>,
    icon: Option<String>,
    site_name: Option<String>,
}

pub struct LinkPreviews {
    client: reqwest::Client,
}

fn ends_head(body: &[u8]) -> bool {
    body.windows(HEAD_END.len()).any(|window| window.eq_ignore_ascii_case(HEAD_END))
}

impl LinkPreviews {
    pub fn new() -> Result<Self> {
        Ok(Self { client: public_client(SAFARI_USER_AGENT, TIMEOUT)? })
    }

    pub async fn load(&self, address: &str) -> Result<LinkPreview> {
        let page = get_public(&self.client, address, HTML).await?;
        if !page.is_html() {
            return Ok(LinkPreview::default());
        }
        let base = page.url.clone();
        let body = page.read(MAX_HEAD_BYTES, ends_head).await?;
        Ok(head::read(&String::from_utf8_lossy(&body), &base))
    }
}
