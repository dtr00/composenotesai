use std::sync::{Mutex, MutexGuard, PoisonError, TryLockError};

#[derive(Default)]
pub struct Lock<T>(Mutex<T>);

impl<T> Lock<T> {
    pub const fn new(value: T) -> Self {
        Self(Mutex::new(value))
    }

    pub fn lock(&self) -> MutexGuard<'_, T> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn try_lock(&self) -> Option<MutexGuard<'_, T>> {
        match self.0.try_lock() {
            Ok(guard) => Some(guard),
            Err(TryLockError::Poisoned(poisoned)) => Some(poisoned.into_inner()),
            Err(TryLockError::WouldBlock) => None,
        }
    }
}
