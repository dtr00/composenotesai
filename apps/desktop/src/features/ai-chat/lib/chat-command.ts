import type { ChatCommand } from "../config/chat-commands";

const TYPING = /^\/([\p{L}\p{N}_-]*)$/u;
const SENT = /^\/([\p{L}\p{N}_-]+)(?=\s|$)/u;

export function typedCommands(draft: string, commands: ChatCommand[]): ChatCommand[] {
  const match = TYPING.exec(draft);
  if (!match) return [];
  const query = match[1].toLowerCase();
  return commands.filter((command) => command.name.startsWith(query));
}

export function commandIn(message: string, commands: ChatCommand[]): ChatCommand | null {
  const match = SENT.exec(message.trimStart());
  const name = match?.[1].toLowerCase();
  return commands.find((command) => command.name === name) ?? null;
}
