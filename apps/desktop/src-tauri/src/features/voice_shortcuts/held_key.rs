use super::shortcuts::{run, ShortcutEvent};
use crate::shared::lock::Lock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const WATCH_STEP: Duration = Duration::from_millis(20);
const SLACK: Duration = Duration::from_millis(150);
const MISSED_REPEATS: u32 = 3;

#[derive(Clone, Copy)]
pub struct KeyRepeat {
    pub delay: Duration,
    pub interval: Duration,
}

#[derive(Clone, Copy)]
struct Held {
    last_seen: Instant,
    repeating: bool,
}

impl Held {
    fn let_go(self, repeat: KeyRepeat, now: Instant) -> bool {
        let quiet = now.saturating_duration_since(self.last_seen);
        let expected = if self.repeating { repeat.interval * MISSED_REPEATS } else { repeat.delay };
        quiet > expected + SLACK
    }
}

/// Tracks a portal shortcut while it is held. GNOME repeats the activation for as long as the
/// key is down, but reports the release only when the key comes up before its modifiers, so
/// the end of the repeats also counts as letting go.
#[derive(Clone)]
pub struct HeldKey {
    held: Arc<Lock<Option<Held>>>,
    repeat: Option<KeyRepeat>,
}

impl HeldKey {
    pub fn new(repeat: Option<KeyRepeat>) -> Self {
        Self { held: Arc::default(), repeat }
    }

    pub fn activated(&self, app: &AppHandle, on_press: ShortcutEvent, on_release: ShortcutEvent) {
        let now = Instant::now();
        let mut held = self.held.lock();
        if let Some(held) = held.as_mut() {
            *held = Held { last_seen: now, repeating: true };
            return;
        }
        *held = Some(Held { last_seen: now, repeating: false });
        drop(held);
        run(app, on_press);
        self.watch(app.clone(), on_release);
    }

    pub fn deactivated(&self, app: &AppHandle, on_release: ShortcutEvent) {
        if self.held.lock().take().is_some() {
            run(app, on_release);
        }
    }

    fn watch(&self, app: AppHandle, on_release: ShortcutEvent) {
        let Some(repeat) = self.repeat else {
            return;
        };
        let key = self.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(WATCH_STEP);
            let mut held = key.held.lock();
            match *held {
                Some(state) if state.let_go(repeat, Instant::now()) => {
                    *held = None;
                    drop(held);
                    return run(&app, on_release);
                }
                Some(_) => {}
                None => return,
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPEAT: KeyRepeat = KeyRepeat { delay: Duration::from_millis(500), interval: Duration::from_millis(30) };

    #[test]
    fn waits_out_the_repeat_delay_before_the_first_repeat() {
        let start = Instant::now();
        let pressed = Held { last_seen: start, repeating: false };
        assert!(!pressed.let_go(REPEAT, start + Duration::from_millis(600)));
        assert!(pressed.let_go(REPEAT, start + Duration::from_millis(700)));
    }

    #[test]
    fn notices_quickly_when_repeats_stop() {
        let start = Instant::now();
        let repeating = Held { last_seen: start, repeating: true };
        assert!(!repeating.let_go(REPEAT, start + Duration::from_millis(200)));
        assert!(repeating.let_go(REPEAT, start + Duration::from_millis(260)));
    }
}
