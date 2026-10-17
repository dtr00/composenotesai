const THINK_OPEN: &str = "<think>";
const THINK_CLOSE: &str = "</think>";

#[derive(Default)]
pub struct LineReader {
    buffer: Vec<u8>,
}

impl LineReader {
    pub fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.buffer.extend_from_slice(chunk);
        let mut lines = Vec::new();
        while let Some(end) = self.buffer.iter().position(|&byte| byte == b'\n') {
            let line: Vec<u8> = self.buffer.drain(..=end).collect();
            let text = String::from_utf8_lossy(&line).trim_end_matches(['\r', '\n']).to_owned();
            if !text.is_empty() {
                lines.push(text);
            }
        }
        lines
    }

    pub fn finish(self) -> Option<String> {
        let text = String::from_utf8_lossy(&self.buffer).trim().to_owned();
        (!text.is_empty()).then_some(text)
    }
}

pub fn sse_data(line: &str) -> Option<&str> {
    line.strip_prefix("data:").map(str::trim_start)
}

#[derive(Debug, PartialEq)]
pub enum Piece {
    Text(String),
    Reasoning(String),
}

#[derive(Default)]
pub struct ThinkSplitter {
    pending: String,
    thinking: bool,
    started: bool,
}

fn partial_tag_len(text: &str, tag: &str) -> usize {
    (1..tag.len()).rev().find(|&len| text.ends_with(&tag[..len])).unwrap_or(0)
}

impl ThinkSplitter {
    pub fn push(&mut self, delta: &str) -> Vec<Piece> {
        self.pending.push_str(delta);
        let mut pieces = Vec::new();
        loop {
            if !self.started {
                let trimmed = self.pending.trim_start();
                if trimmed.is_empty() || (THINK_OPEN.starts_with(trimmed) && trimmed.len() < THINK_OPEN.len()) {
                    return pieces;
                }
                self.started = true;
                if let Some(rest) = trimmed.strip_prefix(THINK_OPEN) {
                    self.thinking = true;
                    self.pending = rest.to_owned();
                }
            }
            if !self.thinking {
                pieces.push(Piece::Text(std::mem::take(&mut self.pending)));
                return pieces
                    .into_iter()
                    .filter(|piece| !matches!(piece, Piece::Text(text) if text.is_empty()))
                    .collect();
            }
            if let Some(end) = self.pending.find(THINK_CLOSE) {
                let reasoning = self.pending[..end].to_owned();
                self.pending = self.pending[end + THINK_CLOSE.len()..].trim_start().to_owned();
                self.thinking = false;
                if !reasoning.is_empty() {
                    pieces.push(Piece::Reasoning(reasoning));
                }
                continue;
            }
            let keep = partial_tag_len(&self.pending, THINK_CLOSE);
            let ready = self.pending.len() - keep;
            if ready > 0 {
                pieces.push(Piece::Reasoning(self.pending[..ready].to_owned()));
                self.pending.drain(..ready);
            }
            return pieces;
        }
    }

    pub fn finish(&mut self) -> Option<Piece> {
        let rest = std::mem::take(&mut self.pending);
        if rest.is_empty() {
            None
        } else if self.thinking {
            Some(Piece::Reasoning(rest))
        } else {
            Some(Piece::Text(rest))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn split(chunks: &[&str]) -> (String, String) {
        let mut splitter = ThinkSplitter::default();
        let mut text = String::new();
        let mut reasoning = String::new();
        let mut pieces: Vec<Piece> = chunks.iter().flat_map(|chunk| splitter.push(chunk)).collect();
        pieces.extend(splitter.finish());
        for piece in pieces {
            match piece {
                Piece::Text(delta) => text.push_str(&delta),
                Piece::Reasoning(delta) => reasoning.push_str(&delta),
            }
        }
        (text, reasoning)
    }

    #[test]
    fn reads_lines_across_chunks() {
        let mut reader = LineReader::default();
        assert!(reader.push(b"data: {\"a\"").is_empty());
        assert_eq!(reader.push(b":1}\r\n\r\ndata: [DONE]\n"), ["data: {\"a\":1}", "data: [DONE]"]);
        assert_eq!(reader.push(b"{\"done\":true}"), Vec::<String>::new());
        assert_eq!(reader.finish().as_deref(), Some("{\"done\":true}"));
        assert_eq!(sse_data("data: [DONE]"), Some("[DONE]"));
        assert_eq!(sse_data(": keep-alive"), None);
    }

    #[test]
    fn passes_plain_text_through() {
        assert_eq!(split(&["Hello", " world"]), ("Hello world".into(), String::new()));
    }

    #[test]
    fn splits_inline_thinking_even_when_tags_are_cut() {
        assert_eq!(split(&["<thi", "nk>plan", " it</th", "ink>\n\nAnswer"]), ("Answer".into(), "plan it".into()));
    }

    #[test]
    fn treats_later_think_tags_as_text() {
        assert_eq!(split(&["Use <think> tags"]), ("Use <think> tags".into(), String::new()));
    }

    #[test]
    fn keeps_unfinished_thinking_as_reasoning() {
        assert_eq!(split(&["<think>still going"]), (String::new(), "still going".into()));
    }
}
