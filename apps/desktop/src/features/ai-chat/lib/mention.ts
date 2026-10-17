export type MentionTrigger = "@" | "#";

const PATTERNS: Record<MentionTrigger, RegExp> = {
  "@": /(?:^|\s)@([^\s@][^@\n]{0,59})?$/,
  "#": /(?:^|\s)#([^\s#][^#\n]{0,59})?$/,
};
const LISTED = 6;

export interface Mention {
  trigger: MentionTrigger;
  from: number;
  query: string;
}

function mentionFor(trigger: MentionTrigger, before: string): Mention | null {
  const match = PATTERNS[trigger].exec(before);
  if (!match) return null;
  const query = match[1] ?? "";
  return { trigger, from: before.length - query.length - 1, query };
}

export function mentionAt(text: string, caret: number): Mention | null {
  const before = text.slice(0, caret);
  const found = [mentionFor("@", before), mentionFor("#", before)].filter((mention) => mention !== null);
  return found.reduce<Mention | null>(
    (latest, mention) => (latest && latest.from > mention.from ? latest : mention),
    null,
  );
}

export function matchingTitles<T extends { title: string }>(items: T[], query: string): T[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return items.slice(0, LISTED);
  const title = (item: T) => item.title.toLowerCase();
  const starting = items.filter((item) => title(item).startsWith(wanted));
  const containing = items.filter((item) => !title(item).startsWith(wanted) && title(item).includes(wanted));
  return [...starting, ...containing].slice(0, LISTED);
}

export const insertMention = (text: string, mention: Mention, caret: number, title: string) =>
  `${text.slice(0, mention.from)}${mention.trigger}${title} ${text.slice(caret).replace(/^ /, "")}`;
