use super::hotkeys::{AppHotkeys, Hotkey};
use super::windows_key_names;
use super::{Owner, PressedHotkey, HOTKEY_EVENT};
use crate::shared::error::Result;
use tauri::{Manager, Webview};
use webview2_com::AcceleratorKeyPressedEventHandler;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
    COREWEBVIEW2_PHYSICAL_KEY_STATUS,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, GetKeyboardState, ToUnicode, VIRTUAL_KEY, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LWIN, VK_MENU,
    VK_RCONTROL, VK_RMENU, VK_RWIN, VK_SHIFT,
};

const KEEP_KEYBOARD_STATE: u32 = 0b100;
const MODIFIER_KEYS: [VIRTUAL_KEY; 6] = [VK_CONTROL, VK_LCONTROL, VK_RCONTROL, VK_MENU, VK_LMENU, VK_RMENU];

fn is_down(key: VIRTUAL_KEY) -> bool {
    unsafe { GetKeyState(i32::from(key.0)) < 0 }
}

fn typed_character(virtual_key: u32, scan_code: u32) -> Option<char> {
    let mut state = [0u8; 256];
    unsafe { GetKeyboardState(&mut state) }.ok()?;
    for key in MODIFIER_KEYS {
        state[usize::from(key.0)] = 0;
    }
    let mut buffer = [0u16; 4];
    let written = unsafe { ToUnicode(virtual_key, scan_code, Some(&state), &mut buffer, KEEP_KEYBOARD_STATE) };
    if written != 1 {
        return None;
    }
    char::from_u32(u32::from(buffer[0]))
}

fn pressed(virtual_key: u32, scan_code: u32) -> Option<Hotkey> {
    if is_down(VK_LWIN) || is_down(VK_RWIN) {
        return None;
    }
    let key = windows_key_names::key(virtual_key, typed_character(virtual_key, scan_code))?;
    Some(Hotkey { key, primary: is_down(VK_CONTROL), alt: is_down(VK_MENU), shift: is_down(VK_SHIFT) })
}

pub fn forward_app_hotkeys(view: &Webview, owner: Owner) -> Result<()> {
    view.with_webview(move |platform| {
        let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let (mut kind, mut virtual_key) = (COREWEBVIEW2_KEY_EVENT_KIND::default(), 0);
            let mut status = COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();
            unsafe {
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut virtual_key)?;
                args.PhysicalKeyStatus(&mut status)?;
            }
            if !matches!(kind, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN | COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN) {
                return Ok(());
            }
            let Some(action) = pressed(virtual_key, status.ScanCode)
                .and_then(|hotkey| owner.app.state::<AppHotkeys>().action(&hotkey))
            else {
                return Ok(());
            };
            if !status.WasKeyDown.as_bool() {
                owner.emit(HOTKEY_EVENT, PressedHotkey { action });
            }
            unsafe { args.SetHandled(true) }
        }));
        let mut token = 0;
        if let Err(error) = unsafe { platform.controller().add_AcceleratorKeyPressed(&handler, &mut token) } {
            eprintln!("[browser] couldn't forward app shortcuts: {error}");
        }
    })?;
    Ok(())
}
