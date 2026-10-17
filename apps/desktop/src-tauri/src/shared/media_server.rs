use crate::shared::error::{Error, Result};
use crate::shared::secret::secret;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

const MAX_HEADER_LINES: usize = 64;
const STALL_TIMEOUT: Duration = Duration::from_secs(30);

pub struct Slice {
    pub mime: &'static str,
    pub total: u64,
    pub start: u64,
    pub data: Vec<u8>,
}

pub trait MediaReader: Send + Sync + 'static {
    fn read(&self, id: i64, start: u64, last: Option<u64>) -> Result<Slice>;
}

pub fn parse_range(value: &str) -> Option<(u64, Option<u64>)> {
    let first = value.strip_prefix("bytes=")?.split(',').next()?.trim();
    let (start, end) = first.split_once('-')?;
    let start = start.parse().ok()?;
    let end = if end.is_empty() { None } else { Some(end.parse().ok().filter(|&end| end >= start)?) };
    Some((start, end))
}

struct Request {
    head_only: bool,
    id: i64,
    range: Option<(u64, Option<u64>)>,
}

fn read_request(stream: &TcpStream, token: &str) -> Option<Request> {
    let mut lines = BufReader::new(stream).lines();
    let request_line = lines.next()?.ok()?;
    let mut parts = request_line.split_whitespace();
    let head_only = match parts.next()? {
        "GET" => false,
        "HEAD" => true,
        _ => return None,
    };
    let (prefix, id) = parts.next()?.trim_start_matches('/').split_once('/')?;
    if prefix != token {
        return None;
    }
    let mut range = None;
    for line in lines.take(MAX_HEADER_LINES) {
        let line = line.ok()?;
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("range") {
                range = parse_range(value.trim());
            }
        }
    }
    Some(Request { head_only, id: id.parse().ok()?, range })
}

fn respond(mut stream: &TcpStream, status: &str, headers: &[(&str, String)]) -> io::Result<()> {
    let mut head = format!("HTTP/1.1 {status}\r\nConnection: close\r\nCache-Control: no-store\r\n");
    for (name, value) in headers {
        head.push_str(&format!("{name}: {value}\r\n"));
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes())
}

fn empty(stream: &TcpStream, status: &str) -> io::Result<()> {
    respond(stream, status, &[("Content-Length", "0".into())])
}

fn serve(mut stream: &TcpStream, request: &Request, reader: &dyn MediaReader) -> io::Result<()> {
    let (start, last) = request.range.unwrap_or((0, None));
    let first = match reader.read(request.id, start, last) {
        Ok(first) => first,
        Err(Error::NotFound(..)) => return empty(stream, "404 Not Found"),
        Err(error) => {
            eprintln!("[media] couldn't read media {}: {error}", request.id);
            return empty(stream, "500 Internal Server Error");
        }
    };
    let total = first.total;
    if start > 0 && start >= total {
        return respond(stream, "416 Range Not Satisfiable", &[("Content-Range", format!("bytes */{total}"))]);
    }
    let end = last.map_or(total, |last| last.saturating_add(1).min(total));
    let mut headers = vec![
        ("Content-Type", first.mime.to_string()),
        ("Content-Length", (end - start).to_string()),
        ("Accept-Ranges", "bytes".to_string()),
    ];
    let status = if request.range.is_some() {
        headers.push(("Content-Range", format!("bytes {start}-{}/{total}", end.saturating_sub(1))));
        "206 Partial Content"
    } else {
        "200 OK"
    };
    respond(stream, status, &headers)?;
    if request.head_only {
        return Ok(());
    }
    let mut slice = first;
    let mut position = start;
    while position < end {
        let wanted = usize::try_from(end - position).unwrap_or(usize::MAX).min(slice.data.len());
        if wanted == 0 {
            break;
        }
        stream.write_all(&slice.data[..wanted])?;
        position += wanted as u64;
        if position >= end {
            break;
        }
        match reader.read(request.id, position, Some(end - 1)) {
            Ok(next) if next.start == position => slice = next,
            _ => break,
        }
    }
    stream.flush()
}

fn handle(stream: &TcpStream, token: &str, reader: &dyn MediaReader) -> io::Result<()> {
    stream.set_read_timeout(Some(STALL_TIMEOUT))?;
    stream.set_write_timeout(Some(STALL_TIMEOUT))?;
    match read_request(stream, token) {
        Some(request) => serve(stream, &request, reader),
        None => empty(stream, "404 Not Found"),
    }
}

pub fn start(reader: impl MediaReader) -> Result<String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let token: Arc<str> = secret()?.into();
    let base = format!("http://127.0.0.1:{}/{token}", listener.local_addr()?.port());
    let reader: Arc<dyn MediaReader> = Arc::new(reader);
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let (reader, token) = (Arc::clone(&reader), Arc::clone(&token));
            thread::spawn(move || {
                let _ = handle(&stream, &token, reader.as_ref());
            });
        }
    });
    Ok(base)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    struct Bytes(Vec<u8>);

    impl MediaReader for Bytes {
        fn read(&self, id: i64, start: u64, last: Option<u64>) -> Result<Slice> {
            if id != 7 {
                return Err(Error::NotFound("Media", id));
            }
            let total = self.0.len() as u64;
            let end = last.map_or(total, |last| (last + 1).min(total)).min(start + 3);
            let data = self.0.get(start as usize..end as usize).unwrap_or_default().to_vec();
            Ok(Slice { mime: "video/mp4", total, start, data })
        }
    }

    fn fetch(base: &str, path: &str, range: Option<&str>) -> String {
        let address = base.trim_start_matches("http://").split('/').next().unwrap();
        let mut stream = TcpStream::connect(address).unwrap();
        let range = range.map(|range| format!("Range: {range}\r\n")).unwrap_or_default();
        write!(stream, "GET {path} HTTP/1.1\r\nHost: x\r\n{range}\r\n").unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }

    #[test]
    fn serves_whole_files_and_ranges_in_chunks() {
        let base = start(Bytes(b"0123456789".to_vec())).unwrap();
        let token = base.rsplit('/').next().unwrap();
        let whole = fetch(&base, &format!("/{token}/7"), None);
        assert!(whole.starts_with("HTTP/1.1 200 OK") && whole.ends_with("\r\n\r\n0123456789"));
        let part = fetch(&base, &format!("/{token}/7"), Some("bytes=2-6"));
        assert!(part.starts_with("HTTP/1.1 206") && part.contains("Content-Range: bytes 2-6/10"));
        assert!(part.ends_with("\r\n\r\n23456"));
    }

    #[test]
    fn rejects_requests_without_the_token_or_for_missing_media() {
        let base = start(Bytes(b"0123456789".to_vec())).unwrap();
        let token = base.rsplit('/').next().unwrap();
        assert!(fetch(&base, "/wrong/7", None).starts_with("HTTP/1.1 404"));
        assert!(fetch(&base, &format!("/{token}/8"), None).starts_with("HTTP/1.1 404"));
    }

    #[test]
    fn ranges_parse_open_and_closed_forms() {
        assert_eq!(parse_range("bytes=0-"), Some((0, None)));
        assert_eq!(parse_range("bytes=100-199"), Some((100, Some(199))));
        assert_eq!(parse_range("bytes=5-2"), None);
        assert_eq!(parse_range("bytes=5-9, 20-30"), Some((5, Some(9))));
        assert_eq!(parse_range("bytes=-500"), None);
    }
}
