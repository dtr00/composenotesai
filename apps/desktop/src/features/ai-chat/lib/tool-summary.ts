import { counted, joinWithAnd } from "../../../shared/lib/plural";

export interface ToolAction {
  verb: string;
  noun: string | null;
}

interface ToolCall {
  action: ToolAction | undefined;
  noteId: number | null;
}

const OTHER: ToolAction = { verb: "Used", noun: "tool" };

const amount = (count: number, noun: string) => (count === 1 ? `a ${noun}` : counted(count, noun));

export function toolSummary(calls: ToolCall[]): string {
  const groups = new Map<string, { action: ToolAction; targets: Set<string> }>();
  calls.forEach((call, index) => {
    const action = call.action ?? OTHER;
    const key = `${action.verb}:${action.noun ?? ""}`;
    const group = groups.get(key) ?? { action, targets: new Set<string>() };
    group.targets.add(call.noteId === null ? `call ${index}` : `note ${call.noteId}`);
    groups.set(key, group);
  });
  const phrases = [...groups.values()].map(({ action, targets }) =>
    action.noun === null ? action.verb : `${action.verb} ${amount(targets.size, action.noun)}`,
  );
  return joinWithAnd(phrases.map((phrase, index) => (index === 0 ? phrase : phrase.toLowerCase())));
}
