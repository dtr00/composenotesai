use gtk::{gio::DesktopAppInfo, glib::KeyFile};
use std::path::Path;
use tauri::AppHandle;

pub fn ensure(app: &AppHandle) -> std::io::Result<()> {
    let desktop_id = format!("{}.desktop", app.config().identifier);
    if DesktopAppInfo::new(&desktop_id).is_some() {
        return Ok(());
    }
    let directory = gtk::glib::user_data_dir().join("applications");
    std::fs::create_dir_all(&directory)?;
    let name = app.config().product_name.as_deref().unwrap_or("Compose Notes AI");
    let entry = entry(name, &std::env::current_exe()?);
    std::fs::write(directory.join(desktop_id), entry.to_data())
}

fn entry(name: &str, executable: &Path) -> KeyFile {
    let keyfile = KeyFile::new();
    keyfile.set_string("Desktop Entry", "Type", "Application");
    keyfile.set_string("Desktop Entry", "Name", name);
    keyfile.set_boolean("Desktop Entry", "NoDisplay", true);
    let mut command = String::from("\"");
    for character in executable.to_string_lossy().chars() {
        match character {
            '%' => command.push_str("%%"),
            '\\' | '"' | '`' | '$' => {
                command.push('\\');
                command.push(character);
            }
            _ => command.push(character),
        }
    }
    command.push('"');
    keyfile.set_string("Desktop Entry", "Exec", &command);
    keyfile
}

#[cfg(test)]
mod tests {
    use super::*;
    use gtk::gio::prelude::AppInfoExt;

    #[test]
    fn desktop_entry_is_valid_and_hidden_from_the_launcher() {
        let keyfile = entry("Compose Notes AI", &std::env::current_exe().unwrap());
        let info = DesktopAppInfo::from_keyfile(&keyfile).unwrap();
        assert_eq!(info.name(), "Compose Notes AI");
        assert!(info.is_nodisplay());
    }

    #[test]
    fn executable_paths_preserve_spaces_and_reserved_characters() {
        let executable = "/tmp/voice app/quote\" dollar$ tick` slash\\ percent%";
        let keyfile = entry("Voice", Path::new(executable));
        let serialized = keyfile.to_data();
        let parsed = KeyFile::new();
        parsed.load_from_data(&serialized, gtk::glib::KeyFileFlags::NONE).unwrap();
        let command = parsed.string("Desktop Entry", "Exec").unwrap();
        let arguments = gtk::glib::shell_parse_argv(&command).unwrap();
        assert_eq!(arguments, [std::ffi::OsString::from(executable.replace('%', "%%"))]);
    }
}
