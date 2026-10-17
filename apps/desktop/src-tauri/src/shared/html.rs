use crate::shared::text::collapse_whitespace;

const SKIPPED: &[&str] = &[
    "script", "style", "noscript", "svg", "template", "iframe", "nav", "footer", "aside", "form", "button", "select",
    "head",
];
const BLOCKS: &[&str] = &[
    "p",
    "div",
    "section",
    "article",
    "main",
    "header",
    "br",
    "hr",
    "tr",
    "table",
    "ul",
    "ol",
    "dl",
    "dt",
    "dd",
    "blockquote",
    "pre",
    "figure",
    "figcaption",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
];

fn entity(name: &str) -> Option<char> {
    let numeric = |digits: &str, radix| u32::from_str_radix(digits, radix).ok().and_then(char::from_u32);
    match name {
        "amp" => Some('&'),
        "lt" => Some('<'),
        "gt" => Some('>'),
        "quot" => Some('"'),
        "apos" => Some('\''),
        "nbsp" => Some(' '),
        _ => match name.strip_prefix('#') {
            Some(hex) if hex.starts_with(['x', 'X']) => numeric(&hex[1..], 16),
            Some(decimal) => numeric(decimal, 10),
            None => None,
        },
    }
}

pub fn decode_entities(text: &str) -> String {
    let mut decoded = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(amp) = rest.find('&') {
        decoded.push_str(&rest[..amp]);
        rest = &rest[amp..];
        let semicolon = rest.find(';').filter(|&index| index <= 10);
        match semicolon.and_then(|index| entity(&rest[1..index]).map(|c| (index, c))) {
            Some((index, c)) => {
                decoded.push(c);
                rest = &rest[index + 1..];
            }
            None => {
                decoded.push('&');
                rest = &rest[1..];
            }
        }
    }
    decoded.push_str(rest);
    decoded
}

pub fn plain_text(html: &str) -> String {
    let text: String = Tokens::new(html)
        .filter_map(|token| match token {
            Token::Text(text) => Some(text),
            Token::Tag(_) => None,
        })
        .collect();
    collapse_whitespace(&decode_entities(&text))
}

fn find_from(text: &str, from: usize, needle: &str) -> Option<usize> {
    text.get(from..)?.find(needle).map(|index| from + index)
}

fn tag_end(html: &str, from: usize) -> usize {
    let mut quote = None;
    for (index, c) in html[from..].char_indices() {
        match (quote, c) {
            (Some(open), c) if c == open => quote = None,
            (None, '"' | '\'') => quote = Some(c),
            (None, '>') => return from + index,
            _ => {}
        }
    }
    html.len()
}

pub struct Tag<'a> {
    source: &'a str,
}

impl Tag<'_> {
    pub fn name(&self) -> String {
        let name = self.source.trim_start_matches('/');
        let end = name.find(|c: char| !c.is_ascii_alphanumeric()).unwrap_or(name.len());
        name[..end].to_ascii_lowercase()
    }

    pub fn is_opening(&self) -> bool {
        !self.source.starts_with('/')
    }

    fn is_self_closing(&self) -> bool {
        self.source.ends_with('/')
    }

    pub fn attributes(&self) -> Vec<(String, String)> {
        let mut found = Vec::new();
        let mut rest = self.source.trim_start_matches(|c: char| !c.is_whitespace());
        loop {
            rest = rest.trim_start_matches(|c: char| c.is_whitespace() || c == '/');
            let name_len = rest.find(|c: char| c.is_whitespace() || c == '=' || c == '/').unwrap_or(rest.len());
            if name_len == 0 {
                return found;
            }
            let name = rest[..name_len].to_ascii_lowercase();
            rest = rest[name_len..].trim_start();
            let Some(after_equals) = rest.strip_prefix('=') else {
                found.push((name, String::new()));
                continue;
            };
            rest = after_equals.trim_start();
            let (value, remaining) = match rest.chars().next() {
                Some(quote @ ('"' | '\'')) => {
                    let end = rest[1..].find(quote).map_or(rest.len(), |index| index + 1);
                    (&rest[1..end], rest.get(end + 1..).unwrap_or(""))
                }
                _ => rest.split_at(rest.find(char::is_whitespace).unwrap_or(rest.len())),
            };
            found.push((name, decode_entities(value)));
            rest = remaining;
        }
    }

    pub fn attribute(&self, name: &str) -> Option<String> {
        self.attributes().into_iter().find(|(key, _)| key == name).map(|(_, value)| value)
    }
}

pub enum Token<'a> {
    Text(&'a str),
    Tag(Tag<'a>),
}

pub struct Tokens<'a> {
    html: &'a str,
    lower: String,
    at: usize,
}

impl<'a> Tokens<'a> {
    pub fn new(html: &'a str) -> Self {
        Self { html, lower: html.to_ascii_lowercase(), at: 0 }
    }

    pub fn text_until_closing(&mut self, name: &str) -> &'a str {
        let start = self.at;
        self.skip_to_closing(name);
        &self.html[start..self.at]
    }

    pub fn skip_to_closing(&mut self, name: &str) {
        let closing = format!("</{name}");
        let mut from = self.at;
        self.at = loop {
            let Some(at) = find_from(&self.lower, from, &closing) else { break self.html.len() };
            from = at + closing.len();
            if !self.lower.as_bytes().get(from).is_some_and(u8::is_ascii_alphanumeric) {
                break at;
            }
        };
    }
}

impl<'a> Iterator for Tokens<'a> {
    type Item = Token<'a>;

    fn next(&mut self) -> Option<Token<'a>> {
        loop {
            let open = match find_from(&self.lower, self.at, "<") {
                None if self.at >= self.html.len() => return None,
                None => self.html.len(),
                Some(open) => open,
            };
            if open > self.at {
                let text = &self.html[self.at..open];
                self.at = open;
                return Some(Token::Text(text));
            }
            if self.lower[open..].starts_with("<!--") {
                self.at = find_from(&self.lower, open, "-->").map_or(self.html.len(), |close| close + 3);
                continue;
            }
            let close = tag_end(self.html, open);
            self.at = (close + 1).min(self.html.len());
            return Some(Token::Tag(Tag { source: &self.html[open + 1..close] }));
        }
    }
}

fn element<'a>(html: &'a str, lower: &str, name: &str) -> Option<&'a str> {
    let open = lower.find(&format!("<{name}"))?;
    let start = open + lower[open..].find('>')? + 1;
    let end = lower[start..].find(&format!("</{name}")).map_or(html.len(), |end| start + end);
    Some(&html[start..end])
}

fn content_region<'a>(html: &'a str, lower: &str) -> &'a str {
    ["main", "article"]
        .iter()
        .find_map(|name| element(html, lower, name))
        .or_else(|| element(html, lower, "body"))
        .unwrap_or(html)
}

fn push_break(text: &mut String, lines: usize) {
    let trailing = text.chars().rev().take_while(|&c| c == '\n').count();
    for _ in trailing..lines {
        text.push('\n');
    }
}

fn tidy_lines(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut blank = 0;
    for line in text.lines() {
        let line = collapse_whitespace(line);
        if line.is_empty() || line == "-" {
            blank += 1;
            continue;
        }
        if !out.is_empty() {
            out.push_str(if blank > 0 { "\n\n" } else { "\n" });
        }
        blank = 0;
        out.push_str(&line);
    }
    out
}

pub fn readable_text(html: &str) -> (Option<String>, String) {
    let lower = html.to_ascii_lowercase();
    let title = element(html, &lower, "title").map(plain_text).filter(|title| !title.is_empty());
    let region = content_region(html, &lower);
    let mut text = String::with_capacity(region.len() / 2);
    let mut tokens = Tokens::new(region);
    while let Some(token) = tokens.next() {
        let tag = match token {
            Token::Text(raw) => {
                text.push_str(&decode_entities(raw));
                continue;
            }
            Token::Tag(tag) => tag,
        };
        let name = tag.name();
        let opening = tag.is_opening();
        if opening && !tag.is_self_closing() && SKIPPED.contains(&name.as_str()) {
            tokens.skip_to_closing(&name);
        } else if name == "li" && opening {
            push_break(&mut text, 1);
            text.push_str("- ");
        } else if name.starts_with('h') && name.len() == 2 && opening {
            push_break(&mut text, 2);
            text.push_str("## ");
        } else if BLOCKS.contains(&name.as_str()) || name == "li" {
            push_break(&mut text, if name == "p" { 2 } else { 1 });
        } else if name == "td" || name == "th" {
            text.push(' ');
        }
    }
    (title, tidy_lines(&text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entities_decode_only_when_complete() {
        assert_eq!(decode_entities("a &amp; b &#x41;&#66; &bogus; & c"), "a & b AB &bogus; & c");
    }

    #[test]
    fn plain_text_drops_tags() {
        assert_eq!(plain_text("<b>Tauri</b> is  a <i>framework</i> &amp; more"), "Tauri is a framework & more");
    }

    #[test]
    fn closing_tags_match_whole_names() {
        let mut tokens = Tokens::new("<a>x<abbr>y</abbr></a>");
        tokens.next();
        assert_eq!(tokens.text_until_closing("a"), "x<abbr>y</abbr>");
    }

    #[test]
    fn readable_text_keeps_the_main_content() {
        let html = r#"<html><head><title>Foxes &amp; you</title><style>p{}</style></head>
            <body><nav><a href="/">Home</a> <a>About</a></nav>
            <main><h1>Red foxes</h1><p>They live <b>almost</b> everywhere.</p>
            <script>track()</script><ul><li>Fast</li><li>Clever</li></ul><!-- ad --></main>
            <footer>Copyright</footer></body></html>"#;
        let (title, text) = readable_text(html);
        assert_eq!(title.as_deref(), Some("Foxes & you"));
        assert_eq!(text, "## Red foxes\n\nThey live almost everywhere.\n\n- Fast\n- Clever");
    }

    #[test]
    fn readable_text_survives_broken_markup() {
        let (title, text) = readable_text("<body><p>Cut off <script>never closed");
        assert_eq!(title, None);
        assert_eq!(text, "Cut off");
        assert_eq!(readable_text("plain words").1, "plain words");
        assert_eq!(readable_text("<p>unclosed <b").1, "unclosed");
    }
}
