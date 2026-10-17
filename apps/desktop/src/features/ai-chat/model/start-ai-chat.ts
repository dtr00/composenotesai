import { getSettings } from "../../../entities/settings/model/settings-store";
import { setChatHost, type ChatHost } from "./chat-host";
import { chatShown } from "./chat-store";

export function startAiChat(host: ChatHost) {
  setChatHost(host);
  if (getSettings().chatOpen) chatShown();
}
