use serde::{Serialize, Serializer};
use std::fmt;

#[derive(Debug)]
pub enum Error {
    Db(rusqlite::Error),
    Json(serde_json::Error),
    Io(std::io::Error),
    Tauri(tauri::Error),
    Update(tauri_plugin_updater::Error),
    Http(reqwest::Error),
    NotFound(&'static str, i64),
    Message(String),
}

pub type Result<T> = std::result::Result<T, Error>;

fn describe_request_error(error: &reqwest::Error) -> String {
    let site = error.url().map_or_else(|| "The server".to_owned(), |url| url.origin().ascii_serialization());
    if error.is_connect() {
        format!("Couldn't reach {site}. Check the address and your connection.")
    } else if error.is_timeout() {
        format!("{site} took too long to answer.")
    } else if let Some(status) = error.status() {
        format!("{site} answered with an error ({status}).")
    } else {
        format!("The request to {site} failed: {error}")
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Db(e) => write!(f, "Couldn't use the database: {e}"),
            Error::Json(e) => write!(f, "Couldn't process the JSON data: {e}"),
            Error::Io(e) => write!(f, "{e}"),
            Error::Tauri(e) => write!(f, "{e}"),
            Error::Update(e) => write!(f, "The update failed: {e}"),
            Error::Http(e) => write!(f, "{}", describe_request_error(e)),
            Error::NotFound(item, id) => write!(f, "{item} {id} no longer exists."),
            Error::Message(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Db(e) => Some(e),
            Error::Json(e) => Some(e),
            Error::Io(e) => Some(e),
            Error::Tauri(e) => Some(e),
            Error::Update(e) => Some(e),
            Error::Http(e) => Some(e),
            Error::NotFound(..) | Error::Message(_) => None,
        }
    }
}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Self {
        Error::Db(e)
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Json(e)
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<tauri::Error> for Error {
    fn from(e: tauri::Error) -> Self {
        Error::Tauri(e)
    }
}

impl From<tauri_plugin_updater::Error> for Error {
    fn from(e: tauri_plugin_updater::Error) -> Self {
        Error::Update(e)
    }
}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        Error::Http(e)
    }
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
