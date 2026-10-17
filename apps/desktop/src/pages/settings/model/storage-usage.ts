import { loadStorageUsage, type StorageUsage } from "../../../shared/api/storage";
import { showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

interface StorageState {
  usage: StorageUsage | null;
  loading: boolean;
}

const store = createStore<StorageState>({ usage: null, loading: false });

export function refreshStorageUsage() {
  if (store.get().loading) return;
  updateStore(store, { loading: true });
  loadStorageUsage().then(
    (usage) => updateStore(store, { usage, loading: false }),
    (e) => {
      updateStore(store, { loading: false });
      showError(e, "storage-usage");
    },
  );
}

export const useStorageUsage = () => useStore(store);
