import { appHotkeys, isAppHotkeyAction, type AppHotkeyAction } from "../../../entities/settings/model/keybindings";
import { getSettings, watchSettings } from "../../../entities/settings/model/settings-store";
import { onBrowserHotkey, setBrowserHotkeys } from "../../../shared/api/browser";
import type { Settings } from "../../../shared/api/settings";
import { showError } from "../../../shared/lib/error-toast";

export function forwardBrowserHotkeys(handlers: Record<AppHotkeyAction, () => void>) {
  let sent: Settings["keybindings"] | null = null;
  const send = (settings: Settings) => {
    if (settings.keybindings === sent) return;
    sent = settings.keybindings;
    setBrowserHotkeys(appHotkeys(settings)).catch((error: unknown) => showError(error));
  };
  send(getSettings());
  watchSettings(send);
  void onBrowserHotkey((action) => {
    if (isAppHotkeyAction(action)) handlers[action]();
  });
}
