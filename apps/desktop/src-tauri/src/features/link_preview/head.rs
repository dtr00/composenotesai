use super::LinkPreview;
use crate::shared::html::{decode_entities, Token, Tokens};
use crate::shared::text::collapse_whitespace;
use crate::shared::web::is_http;
use tauri::Url;

const MAX_TEXT_CHARS: usize = 300;
const FAVICON: &str = "/favicon.ico";

struct Head {
    meta: Vec<(String, String)>,
    icons: Vec<(String, String)>,
    title: Option<String>,
}

fn scan(document: &str) -> Head {
    let mut head = Head { meta: Vec::new(), icons: Vec::new(), title: None };
    let mut tokens = Tokens::new(document);
    while let Some(token) = tokens.next() {
        let Token::Tag(tag) = token else { continue };
        match (tag.name().as_str(), tag.is_opening()) {
            ("head", false) | ("body", true) => break,
            ("meta", true) => {
                let key = tag.attribute("property").or_else(|| tag.attribute("name"));
                if let (Some(key), Some(content)) = (key, tag.attribute("content")) {
                    head.meta.push((key.to_ascii_lowercase(), content));
                }
            }
            ("link", true) => {
                if let (Some(rel), Some(href)) = (tag.attribute("rel"), tag.attribute("href")) {
                    head.icons.push((rel.to_ascii_lowercase(), href));
                }
            }
            ("title", true) if head.title.is_none() => {
                head.title = Some(decode_entities(tokens.text_until_closing("title")));
            }
            (name @ ("script" | "style"), true) => tokens.skip_to_closing(name),
            _ => {}
        }
    }
    head
}

fn tidy(text: String) -> Option<String> {
    let text = collapse_whitespace(&text);
    if text.is_empty() {
        return None;
    }
    if text.chars().count() <= MAX_TEXT_CHARS {
        return Some(text);
    }
    Some(format!("{}…", text.chars().take(MAX_TEXT_CHARS).collect::<String>().trim_end()))
}

fn web_url(base: &Url, href: &str) -> Option<String> {
    base.join(href.trim()).ok().filter(is_http).map(String::from)
}

pub fn read(html: &str, base: &Url) -> LinkPreview {
    let head = scan(html);
    let meta = |keys: &[&str]| {
        keys.iter().find_map(|key| head.meta.iter().find(|(name, _)| name == key).map(|(_, value)| value.clone()))
    };
    let icon_with = |wanted: fn(&str) -> bool| {
        head.icons.iter().find(|(rel, _)| rel.split_whitespace().any(wanted)).map(|(_, href)| href.as_str())
    };
    let icon = icon_with(|rel| rel == "icon").or_else(|| icon_with(|rel| rel == "apple-touch-icon")).unwrap_or(FAVICON);
    LinkPreview {
        title: meta(&["og:title", "twitter:title"]).or(head.title.clone()).and_then(tidy),
        description: meta(&["og:description", "twitter:description", "description"]).and_then(tidy),
        image: meta(&["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"])
            .and_then(|href| web_url(base, &href)),
        icon: web_url(base, icon),
        site_name: meta(&["og:site_name", "application-name"]).and_then(tidy),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Url {
        Url::parse("https://example.com/articles/one").unwrap()
    }

    #[test]
    fn open_graph_tags_fill_the_preview() {
        let html = r#"<!doctype html><html><head>
            <title>Fallback title</title>
            <meta property="og:title" content="Tom &amp; Jerry&#39;s &quot;Day&quot;">
            <meta name="description" content="  A long
                day   out. ">
            <meta property='og:image' content='/img/cover.png'>
            <meta property="og:site_name" content="Example">
            <link rel="shortcut icon" href="https://cdn.example.com/icon.png">
        </head><body><meta property="og:title" content="Ignored"></body></html>"#;
        let preview = read(html, &base());
        assert_eq!(preview.title.as_deref(), Some("Tom & Jerry's \"Day\""));
        assert_eq!(preview.description.as_deref(), Some("A long day out."));
        assert_eq!(preview.image.as_deref(), Some("https://example.com/img/cover.png"));
        assert_eq!(preview.icon.as_deref(), Some("https://cdn.example.com/icon.png"));
        assert_eq!(preview.site_name.as_deref(), Some("Example"));
    }

    #[test]
    fn plain_pages_fall_back_to_their_title_and_favicon() {
        let preview = read("<html><head><TITLE>Just a page</TITLE></head></html>", &base());
        assert_eq!(preview.title.as_deref(), Some("Just a page"));
        assert_eq!(preview.description, None);
        assert_eq!(preview.image, None);
        assert_eq!(preview.icon.as_deref(), Some("https://example.com/favicon.ico"));
    }

    #[test]
    fn scripts_comments_and_odd_markup_are_skipped() {
        let html = r#"<head>
            <!-- <meta property="og:title" content="Commented"> -->
            <script>const tag = "<meta property='og:title' content='Scripted'>";</script>
            <meta content="Real > title" property="og:title"/>
            <meta property="og:image" content="javascript:alert(1)">
        </head>"#;
        let preview = read(html, &base());
        assert_eq!(preview.title.as_deref(), Some("Real > title"));
        assert_eq!(preview.image, None);
    }

    #[test]
    fn markers_inside_tags_and_cut_off_markup_do_not_panic() {
        for html in [
            r#"<head><meta content="<body">"#,
            r#"<head><script>var s = "</head>";</script><title>After</title></head>"#,
            r#"<head><title>Cut"#,
            r#"<head><meta property="og:title" content="Cut"#,
            "<head><!-- never closed",
        ] {
            read(html, &base());
        }
    }

    #[test]
    fn reading_stops_at_the_body_but_not_at_markers_inside_scripts() {
        let html = r#"<head><script>var s = "</head><body>";</script><title>After</title></head>
            <body><meta property="og:title" content="Body"></body>"#;
        assert_eq!(read(html, &base()).title.as_deref(), Some("After"));
    }

    #[test]
    fn long_descriptions_are_shortened() {
        let html = format!(r#"<meta name="description" content="{}">"#, "word ".repeat(200));
        let description = read(&html, &base()).description.unwrap();
        assert!(description.ends_with('…'));
        assert!(description.chars().count() <= MAX_TEXT_CHARS + 1);
    }
}
