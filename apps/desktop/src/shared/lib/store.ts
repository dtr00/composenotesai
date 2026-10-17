import { useSyncExternalStore } from "react";

export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const updateStore = <T extends object>(store: Store<T>, changes: Partial<T>) =>
  store.set({ ...store.get(), ...changes });

export const useStore = <T>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get);

export const useSelector = <T, S>(store: Store<T>, select: (state: T) => S): S =>
  useSyncExternalStore(store.subscribe, () => select(store.get()));
