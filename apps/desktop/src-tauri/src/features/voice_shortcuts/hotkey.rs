use std::fmt;

const NAMED_KEYS: &[&str] = &[
    "Enter",
    "Tab",
    "Backspace",
    "Delete",
    "Insert",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Escape",
];

const KEYSYMS: &[(&str, &str)] = &[
    ("ArrowUp", "Up"),
    ("ArrowDown", "Down"),
    ("ArrowLeft", "Left"),
    ("ArrowRight", "Right"),
    ("PageUp", "Page_Up"),
    ("PageDown", "Page_Down"),
    ("Enter", "Return"),
    ("Backspace", "BackSpace"),
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hotkey {
    pub mod_: bool,
    pub alt: bool,
    pub shift: bool,
    pub key: String,
}

#[derive(Debug, PartialEq, Eq)]
pub struct UnsupportedHotkey;

impl Hotkey {
    pub fn new(key: &str, mod_: bool, alt: bool) -> Self {
        Self { mod_, alt, shift: false, key: key.to_owned() }
    }

    pub fn parse(text: &str) -> Result<Self, UnsupportedHotkey> {
        let mut hotkey = Self::new("", false, false);
        let mut rest = text;
        while let Some((modifier, after)) = rest.split_once('+') {
            match modifier {
                "mod" => hotkey.mod_ = true,
                "alt" => hotkey.alt = true,
                "shift" => hotkey.shift = true,
                _ => return Err(UnsupportedHotkey),
            }
            rest = after;
        }
        hotkey.key = supported_key(rest).ok_or(UnsupportedHotkey)?;
        Ok(hotkey)
    }

    pub fn from_portal_description(description: &str) -> Option<Self> {
        let text = description.strip_prefix("Press ").unwrap_or(description).replace('<', "").replace('>', "+");
        let mut parts: Vec<&str> = text.split('+').map(str::trim).filter(|part| !part.is_empty()).collect();
        let key = parts.pop()?;
        let key = KEYSYMS.iter().find(|(_, keysym)| *keysym == key).map_or(key, |(name, _)| name);
        let key = if key.chars().count() == 1 { key.to_lowercase() } else { key.to_owned() };
        let mut hotkey = Self { key, ..Self::new("", false, false) };
        for modifier in parts {
            match modifier.to_lowercase().as_str() {
                "control" | "ctrl" => hotkey.mod_ = true,
                "alt" => hotkey.alt = true,
                "shift" => hotkey.shift = true,
                _ => return None,
            }
        }
        Some(hotkey)
    }

    pub fn has_command_modifier(&self) -> bool {
        self.mod_ || self.alt
    }

    pub fn is_bare(&self) -> bool {
        !self.mod_ && !self.alt && !self.shift
    }

    pub fn to_accelerator(&self) -> String {
        let key = match self.key.as_str() {
            "space" => "Space".to_owned(),
            key if key.len() == 1 => key.to_ascii_uppercase(),
            key => key.to_owned(),
        };
        self.join(["CommandOrControl", "Alt", "Shift"], &key, "+")
    }

    pub fn to_portal_trigger(&self) -> String {
        self.join(["CTRL", "ALT", "SHIFT"], self.keysym(), "+")
    }

    pub fn to_gnome(&self) -> String {
        self.join(["<Control>", "<Alt>", "<Shift>"], self.keysym(), "")
    }

    fn keysym(&self) -> &str {
        KEYSYMS.iter().find(|(name, _)| *name == self.key).map_or(&self.key, |(_, keysym)| keysym)
    }

    fn join(&self, [mod_, alt, shift]: [&str; 3], key: &str, separator: &str) -> String {
        let modifiers = [(self.mod_, mod_), (self.alt, alt), (self.shift, shift)];
        let held = modifiers.into_iter().filter(|(held, _)| *held).map(|(_, name)| name);
        held.chain([key]).collect::<Vec<_>>().join(separator)
    }
}

impl fmt::Display for Hotkey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.join(["mod", "alt", "shift"], &self.key, "+"))
    }
}

fn supported_key(key: &str) -> Option<String> {
    let character = key.len() == 1 && key.bytes().all(|byte| byte.is_ascii_alphanumeric());
    if character {
        Some(key.to_ascii_lowercase())
    } else if key == "space" || is_function_key(key) || NAMED_KEYS.contains(&key) {
        Some(key.to_owned())
    } else {
        None
    }
}

fn is_function_key(key: &str) -> bool {
    key.strip_prefix('F').and_then(|number| number.parse::<u8>().ok()).is_some_and(|number| (1..=24).contains(&number))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed(text: &str) -> Hotkey {
        Hotkey::parse(text).unwrap()
    }

    #[test]
    fn parses_stored_hotkeys() {
        assert_eq!(parsed("mod+alt+r"), Hotkey::new("r", true, true));
        assert_eq!(parsed("shift+alt+F9"), Hotkey { shift: true, ..Hotkey::new("F9", false, true) });
        assert_eq!(parsed("Escape"), Hotkey::new("Escape", false, false));
        assert_eq!(parsed("mod+R").key, "r");
    }

    #[test]
    fn rejects_unknown_modifiers_and_keys() {
        for text in ["", "mod+", "ctrl+r", "mod+,", "mod++", "mod+F25", "mod+Fx", "mod+Super"] {
            assert_eq!(Hotkey::parse(text), Err(UnsupportedHotkey), "{text} should be rejected");
        }
    }

    #[test]
    fn stored_hotkeys_round_trip_in_a_fixed_modifier_order() {
        for text in ["mod+alt+r", "mod+shift+space", "alt+F9", "mod+ArrowUp", "Escape", "mod+alt+shift+7"] {
            assert_eq!(parsed(text).to_string(), text);
        }
        assert_eq!(parsed("shift+alt+mod+r").to_string(), "mod+alt+shift+r");
    }

    #[test]
    fn converts_to_accelerators() {
        assert_eq!(parsed("mod+alt+r").to_accelerator(), "CommandOrControl+Alt+R");
        assert_eq!(parsed("mod+shift+space").to_accelerator(), "CommandOrControl+Shift+Space");
        assert_eq!(parsed("alt+F9").to_accelerator(), "Alt+F9");
        assert_eq!(parsed("mod+ArrowUp").to_accelerator(), "CommandOrControl+ArrowUp");
        assert_eq!(parsed("alt+shift+7").to_accelerator(), "Alt+Shift+7");
        assert_eq!(parsed("Escape").to_accelerator(), "Escape");
    }

    #[test]
    fn converts_to_portal_triggers() {
        assert_eq!(parsed("mod+alt+r").to_portal_trigger(), "CTRL+ALT+r");
        assert_eq!(parsed("alt+shift+ArrowUp").to_portal_trigger(), "ALT+SHIFT+Up");
        assert_eq!(parsed("mod+Enter").to_portal_trigger(), "CTRL+Return");
    }

    #[test]
    fn converts_to_gnome_accelerators() {
        assert_eq!(parsed("mod+alt+Enter").to_gnome(), "<Control><Alt>Return");
        assert_eq!(parsed("alt+PageDown").to_gnome(), "<Alt>Page_Down");
        assert_eq!(parsed("mod+Backspace").to_gnome(), "<Control>BackSpace");
        assert_eq!(parsed("alt+space").to_gnome(), "<Alt>space");
        assert_eq!(parsed("mod+alt+c").to_gnome(), "<Control><Alt>c");
    }

    #[test]
    fn reads_portal_descriptions() {
        let read = |description| Hotkey::from_portal_description(description).map(|hotkey| hotkey.to_string());
        assert_eq!(read("Press <Control><Alt>r").as_deref(), Some("mod+alt+r"));
        assert_eq!(read("Press <Shift><Control>F5").as_deref(), Some("mod+shift+F5"));
        assert_eq!(read("Press <Control><Alt>Escape").as_deref(), Some("mod+alt+Escape"));
        assert_eq!(read("Press <Control><Alt>Return").as_deref(), Some("mod+alt+Enter"));
        assert_eq!(read("Press <Alt>Up").as_deref(), Some("alt+ArrowUp"));
        assert_eq!(read("Ctrl+Alt+R").as_deref(), Some("mod+alt+r"));
        assert_eq!(read("Press <Super>r"), None);
        assert_eq!(read(""), None);
    }

    #[test]
    fn portal_triggers_read_back_as_the_same_hotkey() {
        for text in ["mod+alt+r", "alt+shift+ArrowUp", "mod+Enter", "mod+PageDown", "alt+F5"] {
            let hotkey = parsed(text);
            assert_eq!(Hotkey::from_portal_description(&hotkey.to_portal_trigger()), Some(hotkey.clone()));
            assert_eq!(Hotkey::from_portal_description(&hotkey.to_gnome()), Some(hotkey));
        }
    }
}
