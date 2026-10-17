import { isSettingsPath, SETTINGS_PATH } from "../../../shared/config/routes";
import { currentPath, navigate, subscribeToPath } from "../../../shared/lib/hash-router";

let returnPath = "/";

function rememberPath() {
  const path = currentPath();
  if (!isSettingsPath(path)) returnPath = path;
}

export function trackReturnPath() {
  rememberPath();
  subscribeToPath(rememberPath);
}

export function openSettings() {
  if (!isSettingsPath(currentPath())) navigate(SETTINGS_PATH);
}

export const leaveSettings = () => navigate(returnPath);
