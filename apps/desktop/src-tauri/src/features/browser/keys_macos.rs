use super::hotkeys::{AppHotkeys, Hotkey};
use super::macos_key_names;
use super::{Owner, PressedHotkey, HOTKEY_EVENT};
use crate::shared::error::Result;
use block2::RcBlock;
use objc2::rc::{Retained, Weak};
use objc2::runtime::AnyObject;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventModifierFlags, NSView};
use std::cell::{OnceCell, RefCell};
use std::ptr::{self, NonNull};
use std::rc::Rc;
use tauri::{Manager, Webview};

type Forward = Rc<dyn Fn(&Hotkey, bool) -> bool>;

thread_local! {
    static PAGES: RefCell<Vec<(Weak<NSView>, Forward)>> = const { RefCell::new(Vec::new()) };
    static MONITOR: OnceCell<Option<Retained<AnyObject>>> = const { OnceCell::new() };
}

fn pressed(event: &NSEvent) -> Option<Hotkey> {
    let flags = event.modifierFlags();
    if flags.contains(NSEventModifierFlags::Control) {
        return None;
    }
    let (shift, alt) = (flags.contains(NSEventModifierFlags::Shift), flags.contains(NSEventModifierFlags::Option));
    let characters = event.charactersIgnoringModifiers()?.to_string();
    let key = macos_key_names::key(event.keyCode(), &characters, shift, alt)?;
    Some(Hotkey { key, primary: flags.contains(NSEventModifierFlags::Command), alt, shift })
}

fn is_typing_in(page: &NSView, event: &NSEvent, main: MainThreadMarker) -> bool {
    event
        .window(main)
        .and_then(|window| window.firstResponder())
        .and_then(|responder| responder.downcast::<NSView>().ok())
        .is_some_and(|focused| focused.isDescendantOf(page))
}

fn forwards(event: &NSEvent, main: MainThreadMarker) -> bool {
    let forward = PAGES.with_borrow_mut(|pages| {
        pages.retain(|(page, _)| page.load().is_some());
        pages
            .iter()
            .find(|(page, _)| page.load().is_some_and(|page| is_typing_in(&page, event, main)))
            .map(|(_, forward)| Rc::clone(forward))
    });
    forward.zip(pressed(event)).is_some_and(|(forward, hotkey)| forward(&hotkey, event.isARepeat()))
}

fn watch_keys() -> Option<Retained<AnyObject>> {
    let block = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        let swallowed = MainThreadMarker::new().is_some_and(|main| forwards(unsafe { event.as_ref() }, main));
        if swallowed {
            ptr::null_mut()
        } else {
            event.as_ptr()
        }
    });
    unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &block) }
}

pub fn forward_app_hotkeys(view: &Webview, owner: Owner) -> Result<()> {
    view.with_webview(move |platform| {
        let Some(page) = (unsafe { Retained::retain(platform.inner().cast::<NSView>()) }) else {
            eprintln!("[browser] couldn't forward app shortcuts");
            return;
        };
        let forward: Forward = Rc::new(move |hotkey, repeat| {
            let Some(action) = owner.app.state::<AppHotkeys>().action(hotkey) else { return false };
            if !repeat {
                owner.emit(HOTKEY_EVENT, PressedHotkey { action });
            }
            true
        });
        PAGES.with_borrow_mut(|pages| pages.push((Weak::from_retained(&page), forward)));
        if MONITOR.with(|monitor| monitor.get_or_init(watch_keys).is_none()) {
            eprintln!("[browser] couldn't forward app shortcuts");
        }
    })?;
    Ok(())
}
