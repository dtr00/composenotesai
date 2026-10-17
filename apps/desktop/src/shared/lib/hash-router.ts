import { useSyncExternalStore } from "react";

export const subscribeToPath = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export const currentPath = () => window.location.hash.slice(1) || "/";

export function useHashPath(): string {
  return useSyncExternalStore(subscribeToPath, currentPath);
}

export function navigate(path: string) {
  window.location.replace(`#${path}`);
}
