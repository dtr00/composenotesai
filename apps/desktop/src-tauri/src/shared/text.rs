pub fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whitespace_runs_become_single_spaces() {
        assert_eq!(collapse_whitespace("  a \n\t b  c "), "a b c");
    }

    #[test]
    fn hex_encodes_bytes() {
        assert_eq!(hex(&[0x00, 0xab, 0xff]), "00abff");
    }
}
