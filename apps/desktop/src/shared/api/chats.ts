import { invoke } from "@tauri-apps/api/core";

export interface ChatSummary {
  id: number;
  title: string;
  updatedAt: number;
}

export interface SavedChat {
  id: number;
  title: string;
  messages: unknown;
}

export const listChats = () => invoke<ChatSummary[]>("list_chats");

export const loadChat = (id: number) => invoke<SavedChat>("load_chat", { id });

export const saveChat = (id: number | null, title: string, messages: unknown) =>
  invoke<number>("save_chat", { id, title, messages });

export const deleteChat = (id: number) => invoke<void>("delete_chat", { id });

export interface TextFile {
  name: string;
  text: string;
}

export const readChatAttachment = (path: string) => invoke<TextFile>("read_chat_attachment", { path });

export const readChatAttachmentFile = async (file: File) =>
  invoke<TextFile>("read_chat_attachment_bytes", new Uint8Array(await file.arrayBuffer()), {
    headers: { "x-file-name": encodeURIComponent(file.name) },
  });
