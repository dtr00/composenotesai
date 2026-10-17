use crate::entities::catalog::CatalogSpec;

pub struct SpeechModelSpec {
    pub id: &'static str,
    pub description: &'static str,
    pub download: CatalogSpec,
}

pub const SPEECH_MODELS: &[SpeechModelSpec] = &[
    SpeechModelSpec {
        id: "base",
        description: "Fastest and smallest. Good for clear speech in quiet rooms.",
        download: CatalogSpec {
            file: "ggml-base-q5_1.bin",
            name: "Base",
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
            size: 59_707_625,
            sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
        },
    },
    SpeechModelSpec {
        id: "small",
        description: "Balances speed and accuracy. A good default for most voices.",
        download: CatalogSpec {
            file: "ggml-small-q5_1.bin",
            name: "Small",
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
            size: 190_085_487,
            sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
        },
    },
    SpeechModelSpec {
        id: "large-turbo",
        description: "Most accurate. Best for accents, background noise and less common languages.",
        download: CatalogSpec {
            file: "ggml-large-v3-turbo-q5_0.bin",
            name: "Large Turbo",
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
            size: 574_041_195,
            sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
        },
    },
];

pub fn find_speech_model(id: &str) -> Option<&'static SpeechModelSpec> {
    SPEECH_MODELS.iter().find(|spec| spec.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_and_files_are_unique() {
        for (i, spec) in SPEECH_MODELS.iter().enumerate() {
            let unique = |other: &SpeechModelSpec| other.id != spec.id && other.download.file != spec.download.file;
            assert!(SPEECH_MODELS[i + 1..].iter().all(unique));
        }
    }

    #[test]
    fn checksums_are_sha256_hex() {
        for spec in SPEECH_MODELS.iter().map(|model| &model.download) {
            assert_eq!(spec.sha256.len(), 64);
            assert!(spec.sha256.bytes().all(|b| b.is_ascii_hexdigit()));
            assert!(spec.url.ends_with(spec.file));
        }
    }

    #[test]
    fn finds_models_by_id() {
        assert_eq!(find_speech_model("small").map(|spec| spec.download.file), Some("ggml-small-q5_1.bin"));
        assert!(find_speech_model("huge").is_none());
    }
}
