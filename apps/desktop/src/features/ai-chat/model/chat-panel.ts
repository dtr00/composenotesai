import { createRef } from "react";
import { panelWidth } from "../../../entities/settings/model/panel-width";
import { CHAT_WIDTH_PX } from "../../../entities/settings/model/setting-limits";
import { getSettings, updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { chatShown } from "./chat-store";
import { cancelVoiceMessage } from "./voice-message";

export const chatWidth = panelWidth("chatWidth", CHAT_WIDTH_PX);

export const useChatOpen = () => useSettings().chatOpen;

export const composer = createRef<HTMLTextAreaElement>();
let focusOnMount = false;

export function attachComposer(element: HTMLTextAreaElement | null) {
  composer.current = element;
  if (!element || !focusOnMount) return;
  focusOnMount = false;
  element.focus({ preventScroll: true });
}

export function focusComposer() {
  if (composer.current) composer.current.focus({ preventScroll: true });
  else focusOnMount = true;
}

export function openChatPanel() {
  if (!getSettings().chatOpen) updateSettings({ chatOpen: true });
  chatShown();
  focusComposer();
}

export function closeChatPanel() {
  cancelVoiceMessage();
  updateSettings({ chatOpen: false });
}

export function toggleChat() {
  if (getSettings().chatOpen) closeChatPanel();
  else openChatPanel();
}
