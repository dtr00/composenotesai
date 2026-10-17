fn named_key(virtual_key: u32) -> Option<&'static str> {
    match virtual_key {
        0x08 => Some("Backspace"),
        0x09 => Some("Tab"),
        0x0D => Some("Enter"),
        0x1B => Some("Escape"),
        0x20 => Some("space"),
        0x21 => Some("PageUp"),
        0x22 => Some("PageDown"),
        0x23 => Some("End"),
        0x24 => Some("Home"),
        0x25 => Some("ArrowLeft"),
        0x26 => Some("ArrowUp"),
        0x27 => Some("ArrowRight"),
        0x28 => Some("ArrowDown"),
        0x2D => Some("Insert"),
        0x2E => Some("Delete"),
        _ => None,
    }
}

pub fn key(virtual_key: u32, typed: Option<char>) -> Option<String> {
    if let Some(named) = named_key(virtual_key) {
        return Some(named.to_owned());
    }
    match virtual_key {
        0x30..=0x39 | 0x41..=0x5A => char::from_u32(virtual_key).map(|c| c.to_ascii_lowercase().to_string()),
        0x60..=0x69 => char::from_u32(virtual_key - 0x60 + u32::from(b'0')).map(String::from),
        0x70..=0x87 => Some(format!("F{}", virtual_key - 0x6F)),
        _ => typed.filter(|c| !c.is_control()).map(|c| c.to_lowercase().collect()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_named_like_the_frontend_names_them() {
        assert_eq!(key(0x54, None).as_deref(), Some("t"));
        assert_eq!(key(0x31, None).as_deref(), Some("1"));
        assert_eq!(key(0x61, None).as_deref(), Some("1"));
        assert_eq!(key(0x0D, None).as_deref(), Some("Enter"));
        assert_eq!(key(0x20, None).as_deref(), Some("space"));
        assert_eq!(key(0x21, None).as_deref(), Some("PageUp"));
        assert_eq!(key(0x74, None).as_deref(), Some("F5"));
        assert_eq!(key(0x87, None).as_deref(), Some("F24"));
        assert_eq!(key(0xBC, Some(',')).as_deref(), Some(","));
        assert_eq!(key(0xBC, Some('<')).as_deref(), Some("<"));
        assert_eq!(key(0x11, None), None);
        assert_eq!(key(0xBC, Some('\u{1B}')), None);
    }
}
