import { invoke } from "@tauri-apps/api/core";

export interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  icon: string | null;
  siteName: string | null;
}

export const loadLinkPreview = (url: string) => invoke<LinkPreview>("link_preview", { url });
