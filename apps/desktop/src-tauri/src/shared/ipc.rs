use tauri::ipc::{Channel, InvokeBody, IpcResponse, Request};

fn percent_decode(text: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(text.len());
    let mut rest = text.as_bytes();
    while let [first, tail @ ..] = rest {
        if *first == b'%' {
            let hex = std::str::from_utf8(tail.get(..2)?).ok()?;
            bytes.push(u8::from_str_radix(hex, 16).ok()?);
            rest = &tail[2..];
        } else {
            bytes.push(*first);
            rest = tail;
        }
    }
    String::from_utf8(bytes).ok()
}

pub fn header<'a>(request: &'a Request<'_>, name: &str) -> Option<&'a str> {
    request.headers().get(name).and_then(|value| value.to_str().ok())
}

pub fn encoded_header(request: &Request<'_>, name: &str) -> Option<String> {
    header(request, name).and_then(percent_decode)
}

pub fn forward<T: IpcResponse + Sync>(channel: &Channel<T>) -> impl Fn(T) + Sync + '_ {
    move |message| {
        let _ = channel.send(message);
    }
}

pub fn raw_body<'a>(request: &'a Request<'_>) -> &'a [u8] {
    match request.body() {
        InvokeBody::Raw(bytes) => bytes.as_slice(),
        InvokeBody::Json(_) => &[],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_decoding_restores_unicode_names() {
        assert_eq!(percent_decode("Pasted%20image").as_deref(), Some("Pasted image"));
        assert_eq!(percent_decode("caf%C3%A9").as_deref(), Some("café"));
        assert_eq!(percent_decode("plain").as_deref(), Some("plain"));
        assert_eq!(percent_decode("bad%2"), None);
        assert_eq!(percent_decode("bad%zz"), None);
    }
}
