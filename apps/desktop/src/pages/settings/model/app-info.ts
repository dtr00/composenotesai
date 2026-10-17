import { loadAppInfo } from "../../../shared/api/system";
import { createStore, useStore } from "../../../shared/lib/store";

interface AppInfo {
  name: string;
  version: string;
}

const store = createStore<AppInfo | null>(null);

void loadAppInfo().then((info) => store.set(info));

export const useAppInfo = () => useStore(store);
