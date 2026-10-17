import { loadSystemInfo, loadSystemUsage, type SystemInfo, type SystemUsage } from "../../../shared/api/system";
import { dismissToast, showError } from "../../../shared/lib/error-toast";
import { createStore, updateStore, useStore } from "../../../shared/lib/store";

const POLL_MS = 1000;
export const HISTORY_LENGTH = 60;

interface MonitorState {
  info: SystemInfo | null;
  history: SystemUsage[];
}

const MONITOR_TOAST = "system-monitor";

const store = createStore<MonitorState>({ info: null, history: [] });

const report = (e: unknown) => showError(e, MONITOR_TOAST);

function sample() {
  loadSystemUsage().then((usage) => {
    const history = [...store.get().history, usage].slice(-HISTORY_LENGTH);
    updateStore(store, { history });
    dismissToast(MONITOR_TOAST);
  }, report);
}

export function monitorSystem() {
  if (!store.get().info) loadSystemInfo().then((info) => updateStore(store, { info }), report);
  sample();
  const timer = window.setInterval(sample, POLL_MS);
  return () => window.clearInterval(timer);
}

export const useSystemMonitor = () => useStore(store);
