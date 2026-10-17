import { BookOpen, type LucideIcon } from "lucide-react";
import type { ToolSpec } from "../../../shared/api/ai";
import { findSkill } from "../../../shared/api/skills";
import { requiredString, stringArg, type ToolArgs } from "../lib/tool-args";
import type { ToolAction } from "../lib/tool-summary";
import { chatHost } from "./chat-host";
import type { NoteChange, ToolImage } from "./conversation";
import { WEB_TOOLS } from "./web-tools";

export interface ToolOutcome {
  result: string;
  noteId?: number | null;
  change?: NoteChange;
  image?: ToolImage;
}

export interface ToolVerbs {
  running: string;
  done: string;
}

export interface AgentTool extends ToolSpec {
  edits: boolean;
  vision?: boolean;
  verbs: ToolVerbs;
  noun: string | null;
  icon: LucideIcon;
  label?: (args: ToolArgs, verb: string) => string;
  noteId?: (args: ToolArgs) => number | null;
  preview?: (callId: string, args: ToolArgs) => void;
  discard?: (callId: string) => void;
  run: (args: ToolArgs, callId: string) => Promise<ToolOutcome>;
}

const readSkill: AgentTool = {
  name: "read_skill",
  description: "Read the full instructions of an installed skill. Call this before doing a task a skill covers.",
  parameters: {
    type: "object",
    properties: { name: { type: "string", description: "The skill name, for example meeting-notes." } },
    required: ["name"],
  },
  edits: false,
  verbs: { running: "Reading", done: "Read" },
  noun: "skill",
  icon: BookOpen,
  label: (args, verb) => {
    const name = stringArg(args, "name");
    return name ? `${verb} skill ${name}` : `${verb} skill`;
  },
  run: async (args) => {
    const name = requiredString(args, "name");
    const skill = await findSkill(name);
    if (!skill) return { result: `There's no enabled skill called "${name}".` };
    return { result: `# Skill: ${skill.name}\n\n${skill.body}` };
  },
};

interface ToolOptions {
  allowEdits: boolean;
  hasSkills: boolean;
  web: boolean;
  vision: boolean;
}

export const toolLabel = (tool: AgentTool, args: ToolArgs, status: keyof ToolVerbs) =>
  tool.label?.(args, tool.verbs[status]) ?? tool.verbs[status];

export const toolNamed = (name: string): AgentTool | undefined =>
  [...chatHost().tools, readSkill, ...WEB_TOOLS].find((tool) => tool.name === name);

export function toolAction(name: string): ToolAction | undefined {
  const tool = toolNamed(name);
  return tool && { verb: tool.verbs.done, noun: tool.noun };
}

export const agentTools = ({ allowEdits, hasSkills, web, vision }: ToolOptions): AgentTool[] =>
  [...chatHost().tools, ...(hasSkills ? [readSkill] : []), ...(web ? WEB_TOOLS : [])].filter(
    (tool) => (allowEdits || !tool.edits) && (vision || !tool.vision),
  );
