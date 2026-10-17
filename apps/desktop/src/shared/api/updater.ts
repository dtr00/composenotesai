import { Channel, invoke } from "@tauri-apps/api/core";

export type UpdateEvent =
  | { event: "started"; version: string }
  | { event: "progress"; downloaded: number; total: number | null }
  | { event: "installing" };

export const installUpdate = (onEvent: (event: UpdateEvent) => void) =>
  invoke<void>("install_update", { onEvent: new Channel<UpdateEvent>(onEvent) });
