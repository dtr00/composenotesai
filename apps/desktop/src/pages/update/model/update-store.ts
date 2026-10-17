import { installUpdate } from "../../../shared/api/updater";
import { errorMessage, showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

interface UpdateState {
  version: string;
  downloaded: number;
  total: number | null;
  installing: boolean;
  error: string | null;
}

const store = createStore<UpdateState>({ version: "", downloaded: 0, total: null, installing: false, error: null });

export function useUpdate(): UpdateState {
  return useStore(store);
}

export function installAvailableUpdate(): Promise<boolean> {
  let started = false;
  return new Promise((resolve) => {
    installUpdate((message) => {
      if (message.event === "started") {
        started = true;
        updateStore(store, { version: message.version });
        resolve(true);
      } else if (message.event === "progress") {
        updateStore(store, { downloaded: message.downloaded, total: message.total });
      } else {
        updateStore(store, { installing: true });
      }
    }).then(
      () => resolve(false),
      (e: unknown) => {
        if (started) updateStore(store, { error: errorMessage(e) });
        else showError(e);
        resolve(false);
      },
    );
  });
}
