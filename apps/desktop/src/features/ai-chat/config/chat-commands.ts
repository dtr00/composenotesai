import quizme from "./quizme-command.md?raw";

export interface ChatCommand {
  name: string;
  description: string;
  instructions: string;
}

export const CHAT_COMMANDS: ChatCommand[] = [
  {
    name: "quizme",
    description: "Make a quiz from your notes. Add notes with @ or folders with #, or just name them.",
    instructions: quizme.trim(),
  },
];
