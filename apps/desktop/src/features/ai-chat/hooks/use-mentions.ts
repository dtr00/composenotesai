import { useState, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import type { Entry } from "../../../shared/api/notes";
import { insertMention, matchingTitles, mentionAt, type MentionTrigger } from "../lib/mention";
import { attachEntries } from "../model/attachments";
import { setDraft } from "../model/chat-store";

export interface MentionItem {
  kind: "note" | "folder";
  id: number;
  title: string;
}

function mentionable(entries: Entry[], trigger: MentionTrigger): MentionItem[] {
  return entries.flatMap((entry): MentionItem[] => {
    if (trigger === "@" && entry.kind === "note") return [{ kind: "note", id: entry.id, title: entry.title }];
    if (trigger === "#" && entry.kind === "folder") return [{ kind: "folder", id: entry.id, title: entry.name }];
    return [];
  });
}

function typeInto(element: HTMLTextAreaElement, value: string, caret: number) {
  element.value = value;
  element.focus();
  element.setSelectionRange(caret, caret);
}

export function useMentions(draft: string, textarea: RefObject<HTMLTextAreaElement | null>) {
  const entries = useEntries();
  const [caret, setCaret] = useState(0);
  const [dismissedMentionFrom, setDismissedMentionFrom] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const at = Math.min(caret, draft.length);
  const mention = mentionAt(draft, at);
  if (mention === null && dismissedMentionFrom !== null) setDismissedMentionFrom(null);
  const suggestions =
    mention && mention.from !== dismissedMentionFrom
      ? matchingTitles(mentionable(entries, mention.trigger), mention.query)
      : [];
  const active = Math.min(highlighted, Math.max(suggestions.length - 1, 0));

  const replaceDraft = (next: string, position: number) => {
    if (textarea.current) typeInto(textarea.current, next, position);
    setDraft(next);
    setCaret(position);
  };

  const pick = (item: MentionItem) => {
    if (!mention) return;
    replaceDraft(insertMention(draft, mention, at, item.title), mention.from + item.title.length + 2);
    attachEntries([{ kind: item.kind, id: item.id }], `${mention.trigger}${item.title}`);
    setDismissedMentionFrom(mention.from);
  };

  const startMention = (trigger: MentionTrigger) => {
    const space = at > 0 && !/\s/.test(draft[at - 1]) ? " " : "";
    replaceDraft(`${draft.slice(0, at)}${space}${trigger}${draft.slice(at)}`, at + space.length + 1);
    setDismissedMentionFrom(null);
    setHighlighted(0);
  };

  const trackCaret = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(event.currentTarget.selectionStart);
    setHighlighted(0);
  };

  const consumeKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!mention || suggestions.length === 0 || event.nativeEvent.isComposing) return false;
    if (event.key === "ArrowDown") setHighlighted((active + 1) % suggestions.length);
    else if (event.key === "ArrowUp") setHighlighted((active - 1 + suggestions.length) % suggestions.length);
    else if (event.key === "Enter" || event.key === "Tab") pick(suggestions[active]);
    else if (event.key === "Escape") setDismissedMentionFrom(mention.from);
    else return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  return { suggestions, highlighted: active, setHighlighted, pick, startMention, trackCaret, consumeKey };
}
