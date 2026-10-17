use super::hotkey::Hotkey;
use super::shortcuts::Backend;
use crate::shared::error::Error;
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Binding {
    Record,
    Cancel,
}

impl Binding {
    pub(super) const ALL: [Binding; 2] = [Binding::Record, Binding::Cancel];

    pub(super) fn id(self) -> &'static str {
        match self {
            Binding::Record => "record-voice-note",
            Binding::Cancel => "cancel-voice-note",
        }
    }

    pub(super) fn from_id(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|binding| binding.id() == id)
    }

    pub(super) fn description(self) -> &'static str {
        match self {
            Binding::Record => "Record a voice note",
            Binding::Cancel => "Cancel the voice note being recorded",
        }
    }

    pub(super) fn default_hotkey(self, backend: Backend) -> Hotkey {
        match (self, backend) {
            (Binding::Record, _) => Hotkey::new("r", true, true),
            (Binding::Cancel, Backend::Plugin) => Hotkey::new("Escape", false, false),
            #[cfg(target_os = "linux")]
            (Binding::Cancel, Backend::Portal) => Hotkey::new("c", true, true),
        }
    }

    pub(super) fn other(self) -> Self {
        match self {
            Binding::Record => Binding::Cancel,
            Binding::Cancel => Binding::Record,
        }
    }

    pub(super) fn purpose(self) -> &'static str {
        match self {
            Binding::Record => "records a voice note",
            Binding::Cancel => "cancels a recording",
        }
    }

    pub(super) fn parse(self, text: &str, backend: Backend) -> Result<Hotkey, Error> {
        Hotkey::parse(text).ok().filter(|hotkey| self.accepts(hotkey, backend)).ok_or_else(|| self.invalid(backend))
    }

    fn accepts(self, hotkey: &Hotkey, backend: Backend) -> bool {
        let escape = hotkey.key == "Escape";
        if escape && self != Binding::Cancel {
            return false;
        }
        hotkey.has_command_modifier() || (escape && hotkey.is_bare() && backend == Backend::Plugin)
    }

    fn invalid(self, backend: Backend) -> Error {
        let keys = "Ctrl or Alt with a letter, number, function key, or arrow key";
        Error::Message(match (self, backend) {
            (Binding::Cancel, Backend::Plugin) => format!("Use Esc, or {keys}."),
            _ => format!("Use at least {keys}."),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bindings_round_trip_through_portal_ids() {
        for binding in Binding::ALL {
            assert_eq!(Binding::from_id(binding.id()), Some(binding));
        }
        assert_eq!(Binding::from_id("something-else"), None);
    }

    #[test]
    fn defaults_are_accepted() {
        for binding in Binding::ALL {
            let default = binding.default_hotkey(Backend::Plugin);
            assert_eq!(binding.parse(&default.to_string(), Backend::Plugin).ok(), Some(default));
        }
    }

    #[test]
    fn record_needs_ctrl_or_alt() {
        for text in ["r", "shift+r", "Escape", "mod+alt+Escape", "mod+,", "ctrl+r"] {
            assert!(Binding::Record.parse(text, Backend::Plugin).is_err(), "{text} should be rejected");
        }
        assert!(Binding::Record.parse("alt+shift+7", Backend::Plugin).is_ok());
    }

    #[test]
    fn cancel_also_accepts_escape() {
        let cancel = |text| Binding::Cancel.parse(text, Backend::Plugin).ok().map(|hotkey| hotkey.to_accelerator());
        assert_eq!(cancel("Escape").as_deref(), Some("Escape"));
        assert_eq!(cancel("mod+Escape").as_deref(), Some("CommandOrControl+Escape"));
        assert_eq!(cancel("mod+alt+c").as_deref(), Some("CommandOrControl+Alt+C"));
        assert_eq!(cancel("shift+Escape"), None);
        assert_eq!(cancel("c"), None);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn portal_shortcuts_need_a_modifier() {
        assert!(Binding::Cancel.parse("Escape", Backend::Portal).is_err());
        assert!(Binding::Cancel.parse("mod+alt+c", Backend::Portal).is_ok());
        let default = Binding::Cancel.default_hotkey(Backend::Portal);
        assert_eq!(Binding::Cancel.parse(&default.to_string(), Backend::Portal).ok(), Some(default));
    }
}
