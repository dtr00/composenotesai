use super::SAMPLE_RATE;

const CHUNK_SAMPLES: usize = 25 * SAMPLE_RATE as usize;
const STABLE_SAMPLES: usize = SAMPLE_RATE as usize;

struct Pass {
    heard: usize,
    text: String,
}

#[derive(Default)]
pub struct LiveTranscript {
    committed: String,
    chunk_start: usize,
    passes: Vec<Pass>,
    shown: String,
}

impl LiveTranscript {
    pub fn chunk_start(&self) -> usize {
        self.chunk_start
    }

    pub fn update(&mut self, heard: usize, text: &str) -> String {
        if heard >= CHUNK_SAMPLES {
            self.committed = joined(&self.committed, text);
            self.chunk_start += heard;
            self.passes.clear();
            self.shown.clone_from(&self.committed);
            return self.shown.clone();
        }
        let earlier = self.passes.iter().rev().find(|pass| pass.heard + STABLE_SAMPLES <= heard);
        let agreed = earlier.map(|pass| agreed_prefix(&pass.text, text)).unwrap_or_default();
        let next = joined(&self.committed, &agreed);
        if !starts_with_words(&self.shown, &next) {
            self.shown = next;
        }
        self.passes.retain(|pass| pass.heard + 2 * STABLE_SAMPLES > heard);
        self.passes.push(Pass { heard, text: text.to_owned() });
        self.shown.clone()
    }
}

fn normalized(word: &str) -> String {
    word.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).collect()
}

fn common_words(a: &str, b: &str) -> usize {
    a.split_whitespace().zip(b.split_whitespace()).take_while(|(a, b)| normalized(a) == normalized(b)).count()
}

fn agreed_prefix(previous: &str, latest: &str) -> String {
    latest.split_whitespace().take(common_words(previous, latest)).collect::<Vec<_>>().join(" ")
}

fn starts_with_words(text: &str, prefix: &str) -> bool {
    common_words(text, prefix) == prefix.split_whitespace().count()
}

fn joined(committed: &str, text: &str) -> String {
    [committed, text].into_iter().filter(|part| !part.is_empty()).collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECOND: usize = SAMPLE_RATE as usize;

    #[test]
    fn shows_words_that_held_for_a_second_of_new_audio() {
        let mut live = LiveTranscript::default();
        assert_eq!(live.update(SECOND, "Okay, so for them"), "");
        assert_eq!(live.update(SECOND + SECOND / 2, "Okay so for them"), "");
        let shown = live.update(2 * SECOND, "Okay so for the meeting tomorrow I need");
        assert_eq!(shown, "Okay so for");
        let shown = live.update(3 * SECOND, "Okay so for the meeting tomorrow I need to bring the water");
        assert_eq!(shown, "Okay so for the meeting tomorrow I need");
    }

    #[test]
    fn shown_text_never_shrinks_but_takes_corrections() {
        let mut live = LiveTranscript::default();
        live.update(SECOND, "bring the quarter lit humbers ask");
        let shown = live.update(2 * SECOND, "bring the quarter lit humbers ask them");
        assert_eq!(shown, "bring the quarter lit humbers ask");
        assert_eq!(live.update(3 * SECOND, "bring the quarterly numbers"), "bring the quarter lit humbers ask");
        let shown = live.update(4 * SECOND, "bring the quarterly numbers ask them about");
        assert_eq!(shown, "bring the quarterly numbers");
    }

    #[test]
    fn agreement_ignores_case_and_punctuation() {
        assert_eq!(agreed_prefix("hello, World again", "Hello world. Again!"), "Hello world. Again!");
        assert_eq!(agreed_prefix("buy milk", "buy eggs"), "buy");
        assert_eq!(agreed_prefix("", "anything"), "");
    }

    #[test]
    fn a_full_chunk_is_committed_and_the_next_one_starts_after_it() {
        let mut live = LiveTranscript::default();
        live.update(CHUNK_SAMPLES - SECOND, "first part of the note");
        let shown = live.update(CHUNK_SAMPLES, "first part of the note ends here");
        assert_eq!(shown, "first part of the note ends here");
        assert_eq!(live.chunk_start(), CHUNK_SAMPLES);
        assert_eq!(live.update(SECOND, "and then"), "first part of the note ends here");
        assert_eq!(live.update(2 * SECOND, "and then more"), "first part of the note ends here and then");
    }
}
