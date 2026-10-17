use crate::shared::lock::Lock;
use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Hotkey {
    pub key: String,
    #[serde(rename = "mod")]
    pub primary: bool,
    pub alt: bool,
    pub shift: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Binding {
    action: String,
    #[serde(flatten)]
    hotkey: Hotkey,
}

#[derive(Default)]
pub struct AppHotkeys(Lock<Vec<Binding>>);

impl AppHotkeys {
    pub fn set(&self, bindings: Vec<Binding>) {
        *self.0.lock() = bindings;
    }

    pub fn action(&self, pressed: &Hotkey) -> Option<String> {
        let bindings = self.0.lock();
        bindings.iter().find(|binding| binding.hotkey == *pressed).map(|binding| binding.action.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hotkey(key: &str, primary: bool, shift: bool) -> Hotkey {
        Hotkey { key: key.into(), primary, alt: false, shift }
    }

    #[test]
    fn pressed_hotkeys_find_their_action() {
        let hotkeys = AppHotkeys::default();
        let bindings = r#"[{"action":"newTab","key":"t","mod":true,"alt":false,"shift":false}]"#;
        hotkeys.set(serde_json::from_str(bindings).unwrap());
        assert_eq!(hotkeys.action(&hotkey("t", true, false)).as_deref(), Some("newTab"));
        assert_eq!(hotkeys.action(&hotkey("t", true, true)), None);
        assert_eq!(hotkeys.action(&hotkey("t", false, false)), None);
    }
}
