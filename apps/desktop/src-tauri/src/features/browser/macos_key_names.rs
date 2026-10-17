const FUNCTION_KEYS: [u16; 20] = [
    0x7A, 0x78, 0x63, 0x76, 0x60, 0x61, 0x62, 0x64, 0x65, 0x6D, 0x67, 0x6F, 0x69, 0x6B, 0x71, 0x6A, 0x40, 0x4F, 0x50,
    0x5A,
];

const LETTERS_AND_DIGITS: [(u16, char); 36] = [
    (0x00, 'a'),
    (0x01, 's'),
    (0x02, 'd'),
    (0x03, 'f'),
    (0x04, 'h'),
    (0x05, 'g'),
    (0x06, 'z'),
    (0x07, 'x'),
    (0x08, 'c'),
    (0x09, 'v'),
    (0x0B, 'b'),
    (0x0C, 'q'),
    (0x0D, 'w'),
    (0x0E, 'e'),
    (0x0F, 'r'),
    (0x10, 'y'),
    (0x11, 't'),
    (0x12, '1'),
    (0x13, '2'),
    (0x14, '3'),
    (0x15, '4'),
    (0x16, '6'),
    (0x17, '5'),
    (0x19, '9'),
    (0x1A, '7'),
    (0x1C, '8'),
    (0x1D, '0'),
    (0x1F, 'o'),
    (0x20, 'u'),
    (0x22, 'i'),
    (0x23, 'p'),
    (0x25, 'l'),
    (0x26, 'j'),
    (0x28, 'k'),
    (0x2D, 'n'),
    (0x2E, 'm'),
];

fn named_key(key_code: u16) -> Option<&'static str> {
    match key_code {
        0x24 | 0x4C => Some("Enter"),
        0x30 => Some("Tab"),
        0x31 => Some("space"),
        0x33 => Some("Backspace"),
        0x35 => Some("Escape"),
        0x72 => Some("Insert"),
        0x73 => Some("Home"),
        0x74 => Some("PageUp"),
        0x75 => Some("Delete"),
        0x77 => Some("End"),
        0x79 => Some("PageDown"),
        0x7B => Some("ArrowLeft"),
        0x7C => Some("ArrowRight"),
        0x7D => Some("ArrowDown"),
        0x7E => Some("ArrowUp"),
        _ => None,
    }
}

fn function_key(key_code: u16) -> Option<String> {
    let index = FUNCTION_KEYS.iter().position(|code| *code == key_code)?;
    Some(format!("F{}", index + 1))
}

fn physical_key(key_code: u16) -> Option<char> {
    LETTERS_AND_DIGITS.iter().find(|(code, _)| *code == key_code).map(|(_, key)| *key)
}

pub fn key(key_code: u16, characters: &str, shift: bool, alt: bool) -> Option<String> {
    if let Some(named) = named_key(key_code) {
        return Some(named.to_owned());
    }
    if let Some(function) = function_key(key_code) {
        return Some(function);
    }
    if let Some(physical) = physical_key(key_code).filter(|key| alt || (shift && key.is_ascii_digit())) {
        return Some(physical.to_string());
    }
    characters
        .chars()
        .next()
        .filter(|c| !c.is_control() && !('\u{F700}'..='\u{F8FF}').contains(c))
        .map(|c| c.to_lowercase().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_named_like_the_frontend_names_them() {
        assert_eq!(key(0x11, "t", false, false).as_deref(), Some("t"));
        assert_eq!(key(0x11, "T", true, false).as_deref(), Some("t"));
        assert_eq!(key(0x2B, ",", false, false).as_deref(), Some(","));
        assert_eq!(key(0x2B, "<", true, false).as_deref(), Some("<"));
        assert_eq!(key(0x12, "!", true, false).as_deref(), Some("1"));
        assert_eq!(key(0x12, "1", false, true).as_deref(), Some("1"));
        assert_eq!(key(0x0E, "\u{B4}", false, true).as_deref(), Some("e"));
        assert_eq!(key(0x24, "\r", false, false).as_deref(), Some("Enter"));
        assert_eq!(key(0x31, " ", false, false).as_deref(), Some("space"));
        assert_eq!(key(0x60, "\u{F708}", false, false).as_deref(), Some("F5"));
        assert_eq!(key(0x7B, "\u{F702}", false, false).as_deref(), Some("ArrowLeft"));
        assert_eq!(key(0x3A, "", false, false), None);
    }
}
