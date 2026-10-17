import { invoke } from "@tauri-apps/api/core";

export const loadPanelBackground = () => invoke<ArrayBuffer>("load_panel_background");
export const savePanelBackground = (bytes: ArrayBuffer) => invoke<void>("save_panel_background", bytes);
export const clearPanelBackground = () => invoke<void>("clear_panel_background");
