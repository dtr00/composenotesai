use crate::shared::error::{Error, Result};
use std::process::{Command, Stdio};

const OPENABLE_SCHEMES: [&str; 3] = ["http://", "https://", "mailto:"];
const UNSUPPORTED_LINK: &str = "Only web and email links can be opened.";

pub fn is_openable(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    OPENABLE_SCHEMES.iter().any(|scheme| lower.starts_with(scheme)) && !url.chars().any(char::is_control)
}

fn opener(url: &str) -> Command {
    if cfg!(target_os = "windows") {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", url]);
        command
    } else {
        let mut command = Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" });
        command.arg(url);
        command
    }
}

pub fn open_url(url: &str) -> Result<()> {
    if !is_openable(url) {
        return Err(Error::Message(UNSUPPORTED_LINK.into()));
    }
    let mut child = opener(url.trim()).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()?;
    std::thread::spawn(move || child.wait());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_web_and_mail_links_open() {
        assert!(is_openable("https://example.com/a?b=1&c=2"));
        assert!(is_openable("HTTP://example.com"));
        assert!(is_openable("mailto:someone@example.com"));
        assert!(!is_openable("file:///etc/passwd"));
        assert!(!is_openable("javascript:alert(1)"));
        assert!(!is_openable("https://example.com/\nrm"));
        assert_eq!(open_url("ftp://example.com").unwrap_err().to_string(), UNSUPPORTED_LINK);
    }
}
