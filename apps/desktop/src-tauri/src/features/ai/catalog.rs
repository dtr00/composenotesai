use crate::entities::catalog::CatalogSpec;

pub const ENGINE_BUILD: &str = "b11609";

#[cfg(test)]
const RELEASE_URL: &str = "https://github.com/ggml-org/llama.cpp/releases/download/b11609";

macro_rules! engine_asset {
    ($file:literal, $size:literal, $sha256:literal) => {
        Some(CatalogSpec {
            file: $file,
            name: "The AI engine",
            url: concat!("https://github.com/ggml-org/llama.cpp/releases/download/b11609/", $file),
            size: $size,
            sha256: $sha256,
        })
    };
}

pub const fn engine_asset() -> Option<CatalogSpec> {
    if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        engine_asset!(
            "llama-b11609-bin-ubuntu-vulkan-x64.tar.gz",
            30_359_149,
            "8aff188828de76492343e19905f72408c10f5b870a03592155b0e7dd19b76ed0"
        )
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        engine_asset!(
            "llama-b11609-bin-ubuntu-vulkan-arm64.tar.gz",
            24_120_662,
            "27e37fc8cd9cfa00f99f72c5d4753a81ecbbce30f00266aa9338e5d7ac4dd9fb"
        )
    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        engine_asset!(
            "llama-b11609-bin-win-vulkan-x64.zip",
            32_134_342,
            "7b50bdb2a27b5fe17759104b1d86e082a05583ff1bca8b3202bcfb2a7232a005"
        )
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        engine_asset!(
            "llama-b11609-bin-win-vulkan-arm64.zip",
            24_730_844,
            "e64f14b7e44fdc1307c95ef0082209293a16ba35f1615b5b696ec924227b00d4"
        )
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        engine_asset!(
            "llama-b11609-bin-macos-arm64.tar.gz",
            12_117_158,
            "d03f28b5a5baa9cdfbb01db5ed22c695126c11c193326f14cdc51d001be10f4e"
        )
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        engine_asset!(
            "llama-b11609-bin-macos-x64.tar.gz",
            11_614_045,
            "f95aa88329eb017213114c5f09841e9ee02477dacca2652f2451d322464b4acb"
        )
    } else {
        None
    }
}

pub struct LanguageModelSpec {
    pub description: &'static str,
    pub download: CatalogSpec,
    pub vision: CatalogSpec,
}

pub const LANGUAGE_MODELS: &[LanguageModelSpec] = &[
    LanguageModelSpec {
        description: "Fastest. Good for quick answers and short notes on any computer.",
        download: CatalogSpec {
            file: "Qwen3.5-2B-Q4_K_M.gguf",
            name: "Qwen3.5 2B",
            url: "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf",
            size: 1_280_835_840,
            sha256: "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
        },
        vision: CatalogSpec {
            file: "Qwen3.5-2B-mmproj-F16.gguf",
            name: "Qwen3.5 2B vision",
            url: "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/mmproj-F16.gguf",
            size: 668_227_264,
            sha256: "7035e9cb8d7c6a9681d07eef9a364783e86ea4cd73faab2eabb4f43a101830c7",
        },
    },
    LanguageModelSpec {
        description: "Balances speed and quality. A good default for writing and editing notes.",
        download: CatalogSpec {
            file: "Qwen3.5-4B-Q4_K_M.gguf",
            name: "Qwen3.5 4B",
            url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
            size: 2_740_937_888,
            sha256: "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
        },
        vision: CatalogSpec {
            file: "Qwen3.5-4B-mmproj-F16.gguf",
            name: "Qwen3.5 4B vision",
            url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/mmproj-F16.gguf",
            size: 672_423_616,
            sha256: "cd88edcf8d031894960bb0c9c5b9b7e1fea6ebee02b9f7ce925a00d12891f864",
        },
    },
    LanguageModelSpec {
        description: "Google's efficient model. Strong writing in many languages.",
        download: CatalogSpec {
            file: "gemma-4-E4B-it-Q4_0.gguf",
            name: "Gemma 4 E4B",
            url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_0.gguf",
            size: 4_590_807_392,
            sha256: "a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2",
        },
        vision: CatalogSpec {
            file: "gemma-4-E4B-it-mmproj-Q8_0.gguf",
            name: "Gemma 4 E4B vision",
            url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/mmproj-gemma-4-E4B-it-Q8_0.gguf",
            size: 559_874_816,
            sha256: "197f49a93027f9843772bd24a6a9e0be2a32a788de5a3def330e9c585d86edd1",
        },
    },
    LanguageModelSpec {
        description: "Most capable. Best for long notes and careful edits. Needs a recent GPU or 16 GB of memory.",
        download: CatalogSpec {
            file: "Qwen3.5-9B-Q4_K_M.gguf",
            name: "Qwen3.5 9B",
            url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf",
            size: 5_680_522_464,
            sha256: "03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8",
        },
        vision: CatalogSpec {
            file: "Qwen3.5-9B-mmproj-F16.gguf",
            name: "Qwen3.5 9B vision",
            url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/mmproj-F16.gguf",
            size: 918_166_080,
            sha256: "f70dc3509053962b0d0d3ee8a7eacebf5d60aa560cad78254ae8698516ae029f",
        },
    },
];

pub fn find_language_model(file: &str) -> Option<&'static LanguageModelSpec> {
    LANGUAGE_MODELS.iter().find(|spec| spec.download.file == file)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_valid(spec: &CatalogSpec) {
        assert!(spec.file.ends_with(".gguf"));
        assert!(spec.url.starts_with("https://huggingface.co/"));
        assert_eq!(spec.sha256.len(), 64);
        assert!(spec.sha256.bytes().all(|b| b.is_ascii_hexdigit()));
    }

    #[test]
    fn model_files_are_unique_gguf_files_named_in_their_urls() {
        for (i, model) in LANGUAGE_MODELS.iter().enumerate() {
            let spec = &model.download;
            assert!(LANGUAGE_MODELS[i + 1..].iter().all(|other| other.download.file != spec.file));
            assert!(spec.url.ends_with(spec.file));
            assert_valid(spec);
        }
    }

    #[test]
    fn vision_files_come_from_their_model_repository_under_unique_names() {
        for (i, model) in LANGUAGE_MODELS.iter().enumerate() {
            let repository = model.download.url.rsplit_once('/').map(|(folder, _)| folder);
            assert_eq!(model.vision.url.rsplit_once('/').map(|(folder, _)| folder), repository);
            assert!(LANGUAGE_MODELS[i + 1..].iter().all(|other| other.vision.file != model.vision.file));
            assert!(LANGUAGE_MODELS.iter().all(|other| other.download.file != model.vision.file));
            assert_valid(&model.vision);
        }
    }

    #[test]
    fn this_platform_has_an_engine_from_the_pinned_build() {
        let asset = engine_asset().expect("an engine build for this platform");
        assert!(asset.url.starts_with(RELEASE_URL));
        assert!(asset.url.contains(ENGINE_BUILD));
        assert!(asset.url.ends_with(asset.file));
        assert_eq!(asset.sha256.len(), 64);
    }
}
