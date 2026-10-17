use crate::shared::error::{Error, Result};

const MAX_NAME_LEN: usize = 64;
const MAX_DESCRIPTION_LEN: usize = 1024;
const MAX_BODY_LEN: usize = 64 * 1024;
const FENCE: &str = "---";

#[derive(Debug, PartialEq)]
pub struct ParsedSkill {
    pub name: String,
    pub description: String,
    pub body: String,
}

pub fn slug(text: &str) -> String {
    let mut slug = String::new();
    for c in text.trim().chars().flat_map(char::to_lowercase) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    slug.trim_end_matches('-').chars().take(MAX_NAME_LEN).collect::<String>().trim_end_matches('-').to_owned()
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    let quoted = value.len() >= 2
        && ((value.starts_with('"') && value.ends_with('"')) || (value.starts_with('\'') && value.ends_with('\'')));
    if quoted {
        value[1..value.len() - 1].replace("\\\"", "\"").replace("''", "'")
    } else {
        value.to_owned()
    }
}

fn frontmatter(text: &str) -> (Vec<(String, String)>, &str) {
    let text = text.trim_start_matches('\u{feff}');
    let Some(rest) = text.strip_prefix(FENCE).filter(|rest| rest.starts_with(['\n', '\r'])) else {
        return (Vec::new(), text);
    };
    let Some(end) = rest.find(&format!("\n{FENCE}")) else {
        return (Vec::new(), text);
    };
    let header = &rest[..end];
    let after = &rest[end + 1 + FENCE.len()..];
    let body = after.split_once('\n').map_or("", |(_, body)| body);
    let mut fields: Vec<(String, String)> = Vec::new();
    let mut lines = header.lines().peekable();
    while let Some(line) = lines.next() {
        let Some((key, value)) = line.split_once(':').filter(|_| !line.starts_with([' ', '\t'])) else {
            continue;
        };
        let value = value.trim();
        let value = if matches!(value, ">" | "|" | ">-" | "|-") {
            let mut block = Vec::new();
            while let Some(next) = lines.peek().filter(|next| next.starts_with([' ', '\t']) || next.trim().is_empty()) {
                block.push(next.trim());
                lines.next();
            }
            let joiner = if value.starts_with('>') { " " } else { "\n" };
            block.join(joiner).trim().to_owned()
        } else {
            unquote(value)
        };
        fields.push((key.trim().to_lowercase(), value));
    }
    (fields, body)
}

fn first_heading(body: &str) -> Option<&str> {
    body.lines().find_map(|line| line.strip_prefix('#').map(|heading| heading.trim_start_matches('#').trim()))
}

fn first_paragraph(body: &str) -> String {
    body.split("\n\n")
        .map(str::trim)
        .find(|paragraph| !paragraph.is_empty() && !paragraph.starts_with('#'))
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn validate(name: &str, description: &str, body: &str) -> Result<ParsedSkill> {
    let name = slug(name);
    if name.is_empty() {
        return Err(Error::Message("A skill needs a name. Add “name:” at the top of the file.".into()));
    }
    let description: String = description.trim().chars().take(MAX_DESCRIPTION_LEN).collect();
    if description.is_empty() {
        return Err(Error::Message("A skill needs a description that says when to use it.".into()));
    }
    let body = body.trim();
    if body.is_empty() {
        return Err(Error::Message("This skill has no instructions.".into()));
    }
    if body.len() > MAX_BODY_LEN {
        return Err(Error::Message("This skill is too long. Keep it under 64 KB.".into()));
    }
    Ok(ParsedSkill { name, description, body: body.to_owned() })
}

pub fn parse_skill(text: &str, fallback_name: Option<&str>) -> Result<ParsedSkill> {
    let (fields, body) = frontmatter(text);
    let field = |key: &str| fields.iter().find(|(name, _)| name == key).map(|(_, value)| value.as_str());
    let body = body.trim();
    let name = field("name").or_else(|| first_heading(body)).or(fallback_name).unwrap_or_default();
    let description = field("description").map_or_else(|| first_paragraph(body), str::to_owned);
    validate(name, &description, body)
}

pub fn raw_skill_url(url: &str) -> Result<String> {
    let url = url.trim();
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(Error::Message("Enter a web link to a SKILL.md file.".into()));
    }
    if let Some(path) = url.strip_prefix("https://github.com/") {
        let parts: Vec<&str> = path.splitn(5, '/').collect();
        if let [owner, repo, "blob" | "tree", branch, file] = parts.as_slice() {
            let file = if file.ends_with(".md") {
                (*file).to_owned()
            } else {
                format!("{}/SKILL.md", file.trim_end_matches('/'))
            };
            return Ok(format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}"));
        }
    }
    Ok(url.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_agent_skill_frontmatter() {
        let skill = parse_skill(
            "---\nname: Meeting Notes\ndescription: \"Turn rough notes into a summary\"\nlicense: MIT\n---\n# Meeting notes\n\nWrite a summary.\n",
            None,
        )
        .unwrap();
        assert_eq!(skill.name, "meeting-notes");
        assert_eq!(skill.description, "Turn rough notes into a summary");
        assert_eq!(skill.body, "# Meeting notes\n\nWrite a summary.");
    }

    #[test]
    fn reads_folded_descriptions() {
        let skill =
            parse_skill("---\nname: quiz\ndescription: >\n  Make quizzes\n  from notes.\n---\nAsk questions.", None)
                .unwrap();
        assert_eq!(skill.description, "Make quizzes from notes.");
    }

    #[test]
    fn falls_back_to_the_heading_and_first_paragraph() {
        let skill = parse_skill("# Study Guide\n\nMake a study guide from a note.\n\n1. Read it.", None).unwrap();
        assert_eq!(skill.name, "study-guide");
        assert_eq!(skill.description, "Make a study guide from a note.");
        let named = parse_skill("Plain instructions only.", Some("my file")).unwrap();
        assert_eq!(named.name, "my-file");
    }

    #[test]
    fn rejects_incomplete_skills() {
        assert!(parse_skill("", None).is_err());
        assert!(parse_skill("---\nname: x\n---\n", None).is_err());
        assert!(parse_skill("---\ndescription: y\n---\nbody", None).is_err());
    }

    #[test]
    fn validation_tidies_fields_and_names_what_is_missing() {
        let skill = validate(" Flash Cards ", "  Cards  ", "\nMake cards.\n").unwrap();
        assert_eq!(
            skill,
            ParsedSkill { name: "flash-cards".into(), description: "Cards".into(), body: "Make cards.".into() }
        );
        let error =
            |name: &str, description: &str, body: &str| validate(name, description, body).unwrap_err().to_string();
        assert!(error("!!", "x", "y").contains("needs a name"));
        assert!(error("x", " ", "y").contains("needs a description"));
        assert!(error("x", "y", " ").contains("no instructions"));
        assert!(error("x", "y", &"a".repeat(MAX_BODY_LEN + 1)).contains("too long"));
    }

    #[test]
    fn slugs_are_short_and_tidy() {
        assert_eq!(slug("  Hello,  World! "), "hello-world");
        assert_eq!(slug(&"a".repeat(100)).len(), MAX_NAME_LEN);
        assert_eq!(slug("---"), "");
    }

    #[test]
    fn turns_github_pages_into_raw_files() {
        assert_eq!(
            raw_skill_url("https://github.com/acme/skills/blob/main/quiz/SKILL.md").unwrap(),
            "https://raw.githubusercontent.com/acme/skills/main/quiz/SKILL.md"
        );
        assert_eq!(
            raw_skill_url("https://github.com/acme/skills/tree/main/quiz").unwrap(),
            "https://raw.githubusercontent.com/acme/skills/main/quiz/SKILL.md"
        );
        assert_eq!(raw_skill_url("https://example.com/SKILL.md").unwrap(), "https://example.com/SKILL.md");
        assert!(raw_skill_url("ftp://example.com").is_err());
    }
}
