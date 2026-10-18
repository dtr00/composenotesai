import { toast } from "sonner";
import { checkUpdate, installUpdate, type UpdateEvent } from "../../../shared/api/updater";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AVAILABLE_TOAST_ID = "update-available";

interface UpdateState {
  available: string | null;
  checking: boolean;
  install: UpdateEvent | null;
}

const store = createStore<UpdateState>({ available: null, checking: false, install: null });

export const useUpdate = () => useStore(store);

async function checkForUpdate() {
  updateStore(store, { checking: true });
  try {
    updateStore(store, { available: await checkUpdate() });
  } finally {
    updateStore(store, { checking: false });
  }
}

export async function checkForUpdateNow() {
  try {
    await checkForUpdate();
    if (!store.get().available) toast.success("You have the latest version");
  } catch (e) {
    showError(e);
  }
}

export function watchForUpdates(openSettings: () => void) {
  const check = async () => {
    const previous = store.get().available;
    await checkForUpdate().catch(() => {});
    const { available } = store.get();
    if (!available || available === previous) return;
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
  updateStore(store, { install: { event: "progress", downloaded: 0, total: null } });
  try {
    await installUpdate((install) => updateStore(store, { install }));
    updateStore(store, { available: null });
  } catch (e) {
    showError(e);
  }
  updateStore(store, { install: null });
}
