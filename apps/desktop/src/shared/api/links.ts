import { invoke } from "@tauri-apps/api/core";

export const openUrl = (url: string) => invoke<void>("open_url", { url });
