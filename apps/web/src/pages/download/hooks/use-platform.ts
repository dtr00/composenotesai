import { useSyncExternalStore } from "react";
import type { Platform } from "../config/builds";
import { detectPlatform } from "../lib/detect-platform";

const subscribe = () => () => {};

export function usePlatform(): Platform | null {
  return useSyncExternalStore(
    subscribe,
    () => detectPlatform(navigator),
    () => null,
  );
}
