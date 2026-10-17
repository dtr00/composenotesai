use super::model::first_free_name;
use crate::entities::media::is_media_extension;

pub fn split_media_name(name: &str) -> (&str, Option<&str>) {
    match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.trim().is_empty() && is_media_extension(extension) => {
            (stem.trim_end(), Some(extension))
        }
        _ => (name, None),
    }
}

pub fn free_media_name<'a>(stem: &str, extension: Option<&str>, taken: impl IntoIterator<Item = &'a str>) -> String {
    let suffix = extension.map(|extension| format!(".{extension}")).unwrap_or_default();
    first_free_name(stem, &suffix, taken)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_extensions_are_split_off() {
        assert_eq!(split_media_name("Photo.PNG"), ("Photo", Some("PNG")));
        assert_eq!(split_media_name("v1.2 notes"), ("v1.2 notes", None));
        assert_eq!(split_media_name(".mov"), (".mov", None));
        assert_eq!(split_media_name("clip.final.mov"), ("clip.final", Some("mov")));
    }

    #[test]
    fn numbers_go_before_the_extension() {
        let taken = ["photo.png", "Photo 1.png"];
        assert_eq!(free_media_name("Photo", Some("png"), taken), "Photo 2.png");
        assert_eq!(free_media_name("Photo", Some("jpg"), taken), "Photo.jpg");
        assert_eq!(free_media_name("Photo", None, taken), "Photo");
    }
}
