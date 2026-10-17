use crate::shared::error::{Error, Result};
use reqwest::header::{ACCEPT, CONTENT_TYPE};
use std::net::IpAddr;
use std::time::Duration;
use tauri::Url;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_REDIRECTS: usize = 6;

// Google answers WebKit's own user agent with a captcha but accepts Safari on macOS.
pub const SAFARI_USER_AGENT: &str = concat!(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ",
    "(KHTML, like Gecko) Version/26.0 Safari/605.1.15"
);

pub fn client() -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder().connect_timeout(CONNECT_TIMEOUT).build()?)
}

pub fn public_client(user_agent: &str, timeout: Duration) -> Result<reqwest::Client> {
    let redirects = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            attempt.error("too many redirects")
        } else if is_public(attempt.url()) {
            attempt.follow()
        } else {
            attempt.stop()
        }
    });
    let builder = reqwest::Client::builder().user_agent(user_agent).connect_timeout(CONNECT_TIMEOUT);
    Ok(builder.timeout(timeout).redirect(redirects).build()?)
}

pub struct PublicPage {
    pub url: Url,
    pub content_type: Option<String>,
    response: reqwest::Response,
}

pub async fn get_public(client: &reqwest::Client, address: &str, accept: &str) -> Result<PublicPage> {
    let url = Url::parse(address.trim()).ok().filter(is_public).ok_or_else(|| {
        Error::Message("Only public web pages can be read, with an http or https address.".into())
    })?;
    let response = client.get(url).header(ACCEPT, accept).send().await?;
    if response.status().is_redirection() {
        return Err(Error::Message("That page redirects somewhere that can't be read.".into()));
    }
    let response = response.error_for_status()?;
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or_default().trim().to_ascii_lowercase());
    Ok(PublicPage { url: response.url().clone(), content_type, response })
}

impl PublicPage {
    pub fn is_html(&self) -> bool {
        self.content_type.as_deref().is_none_or(|kind| kind.contains("html"))
    }

    pub async fn read(mut self, max_bytes: usize, enough: impl Fn(&[u8]) -> bool) -> Result<Vec<u8>> {
        let mut body = Vec::new();
        while let Some(chunk) = self.response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() >= max_bytes || enough(&body) {
                break;
            }
        }
        Ok(body)
    }
}

pub fn is_http(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip.to_canonical() {
        IpAddr::V4(ip) => {
            !(ip.is_loopback() || ip.is_unspecified() || ip.is_private() || ip.is_link_local() || ip.is_broadcast())
        }
        IpAddr::V6(ip) => {
            let first = ip.segments()[0];
            !(ip.is_loopback() || ip.is_unspecified() || first & 0xfe00 == 0xfc00 || first & 0xffc0 == 0xfe80)
        }
    }
}

fn is_public(url: &Url) -> bool {
    let Some(host) = url.host_str().filter(|_| is_http(url)) else { return false };
    let host = host.trim_start_matches('[').trim_end_matches(']').trim_end_matches('.').to_ascii_lowercase();
    match host.parse::<IpAddr>() {
        Ok(ip) => is_public_ip(ip),
        Err(_) => host.contains('.') && !host.ends_with(".local") && !host.ends_with(".localhost"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_public_addresses_count_as_public() {
        let public = |url: &str| is_public(&Url::parse(url).unwrap());
        assert!(public("https://en.wikipedia.org/wiki/Fox"));
        assert!(public("http://93.184.216.34/"));
        for local in [
            "http://localhost:11434/api/tags",
            "http://127.0.0.1:8080",
            "http://192.168.1.10/",
            "http://10.0.0.2/",
            "http://169.254.1.1/",
            "http://[::1]:3000/",
            "http://[fd00::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://printer.local/",
            "http://router/",
            "file:///etc/passwd",
        ] {
            assert!(!public(local), "{local}");
        }
    }
}
