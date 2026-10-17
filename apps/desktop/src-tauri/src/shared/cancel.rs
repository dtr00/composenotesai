use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use std::collections::HashMap;
use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Default)]
pub struct CancelToken {
    cancelled: AtomicBool,
    notify: Notify,
}

impl CancelToken {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        self.notify.notify_waiters();
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    async fn cancelled(&self) {
        loop {
            let notified = self.notify.notified();
            if self.is_cancelled() {
                return;
            }
            notified.await;
        }
    }

    pub async fn run<T>(&self, work: impl Future<Output = T>) -> Option<T> {
        tokio::select! {
            biased;
            () = self.cancelled() => None,
            output = work => Some(output),
        }
    }
}

#[derive(Default)]
pub struct Registry {
    running: Lock<HashMap<String, Arc<CancelToken>>>,
}

pub struct Running<'a> {
    registry: &'a Registry,
    id: String,
    token: Arc<CancelToken>,
}

impl Running<'_> {
    pub fn token(&self) -> &CancelToken {
        &self.token
    }
}

impl Drop for Running<'_> {
    fn drop(&mut self) {
        self.registry.running.lock().remove(&self.id);
    }
}

impl Registry {
    pub fn begin(&self, id: &str, busy_message: &str) -> Result<Running<'_>> {
        let mut running = self.running.lock();
        if running.contains_key(id) {
            return Err(Error::Message(busy_message.to_owned()));
        }
        let token = Arc::new(CancelToken::default());
        running.insert(id.to_owned(), Arc::clone(&token));
        Ok(Running { registry: self, id: id.to_owned(), token })
    }

    pub fn is_running(&self, id: &str) -> bool {
        self.running.lock().contains_key(id)
    }

    pub fn cancel(&self, id: &str) {
        if let Some(token) = self.running.lock().get(id) {
            token.cancel();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancelling_stops_waiting_work() {
        let token = CancelToken::default();
        let outcome = tauri::async_runtime::block_on(async {
            let waiting = token.run(std::future::pending::<()>());
            token.cancel();
            waiting.await
        });
        assert!(outcome.is_none());
        assert_eq!(tauri::async_runtime::block_on(token.run(async { 7 })), None);
        assert!(tauri::async_runtime::block_on(CancelToken::default().run(async { 7 })).is_some());
    }

    #[test]
    fn work_cannot_start_twice_and_frees_its_slot_when_done() {
        let registry = Registry::default();
        let first = registry.begin("base", "Base is busy.").unwrap();
        assert_eq!(
            registry.begin("base", "Base is busy.").err().map(|e| e.to_string()).as_deref(),
            Some("Base is busy.")
        );
        assert!(registry.is_running("base"));
        drop(first);
        assert!(!registry.is_running("base"));
        assert!(registry.begin("base", "Base is busy.").is_ok());
    }

    #[test]
    fn cancelling_flags_only_the_matching_work() {
        let registry = Registry::default();
        let a = registry.begin("a", "").unwrap();
        let b = registry.begin("b", "").unwrap();
        registry.cancel("a");
        registry.cancel("missing");
        assert!(a.token().is_cancelled());
        assert!(!b.token().is_cancelled());
        drop(a);
        assert!(!registry.begin("a", "").unwrap().token().is_cancelled());
    }
}
