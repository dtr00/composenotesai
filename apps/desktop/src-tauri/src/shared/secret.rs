use crate::shared::error::{Error, Result};
use crate::shared::text::hex;

const SECRET_BYTES: usize = 16;

pub fn secret() -> Result<String> {
    let mut bytes = [0; SECRET_BYTES];
    getrandom::fill(&mut bytes).map_err(|e| Error::Message(format!("Couldn't create a secret key: {e}")))?;
    Ok(hex(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_are_random_hex() {
        let (first, second) = (secret().unwrap(), secret().unwrap());
        assert_eq!(first.len(), SECRET_BYTES * 2);
        assert!(first.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }
}
