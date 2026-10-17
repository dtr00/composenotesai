import type { AgentTool } from "./agent-tools";
import type { NoteChange } from "./conversation";

export interface HostNote {
  title: string;
  body: string;
}

export interface ChatHost {
  tools: AgentTool[];
  tabNoteIds: () => number[];
  readNote: (id: number) => Promise<HostNote | null>;
  revertNotes: (changes: NoteChange[]) => Promise<void>;
  openLink: (url: string) => void;
}

let host: ChatHost | null = null;

export function setChatHost(chatHost: ChatHost) {
  host = chatHost;
}

export function chatHost(): ChatHost {
  if (!host) throw new Error("The AI chat is used before startAiChat set it up.");
  return host;
}
