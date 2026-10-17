import { toast } from "sonner";
import { checkUpdate, installUpdate } from "../../../shared/api/updater";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AVAILABLE_TOAST_ID = "update-available";

interface UpdateState {
  available: string | null;
  checking: boolean;
  updating: boolean;
  downloaded: number;
  total: number | null;
  installing: boolean;
}

const store = createStore<UpdateState>({
  available: null,
  checking: false,
  updating: false,
  downloaded: 0,
  total: null,
  installing: false,
});

export const useUpdate = () => useStore(store);

export async function checkForUpdate(): Promise<string | null> {
  updateStore(store, { checking: true });
  try {
    const available = await checkUpdate();
    updateStore(store, { available });
    return available;
  } finally {
    updateStore(store, { checking: false });
  }
}

export function watchForUpdates(openSettings: () => void) {
  let notified: string | null = null;
  const check = async () => {
    if (store.get().updating) return;
    const available = await checkForUpdate().catch(() => null);
    if (!available || available === notified) return;
    notified = available;
    toast.info(`Version ${available} is available`, {
      id: AVAILABLE_TOAST_ID,
      duration: Infinity,
      action: { label: "Open settings", onClick: openSettings },
    });
  };
  void check();
  window.setInterval(check, CHECK_INTERVAL_MS);
}

export async function installAvailableUpdate() {
  toast.dismiss(AVAILABLE_TOAST_ID);
  updateStore(store, { updating: true, downloaded: 0, total: null, installing: false });
  try {
    await installUpdate((message) => {
      if (message.event === "progress") updateStore(store, { downloaded: message.downloaded, total: message.total });
      else if (message.event === "installing") updateStore(store, { installing: true });
    });
  } catch (e) {
    showError(e);
  }
  updateStore(store, { updating: false });
}
