import { StateEffect, StateField } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { getEntries, subscribeToNoteList } from "../../../entities/note/model/note-list-store";
import { notesIn, titleKey } from "../../../entities/note/model/note-tree";

const setTitles = StateEffect.define<ReadonlySet<string>>();

const currentTitles = () => new Set(notesIn(getEntries()).map((note) => titleKey(note.title)));

export const noteTitles = StateField.define<ReadonlySet<string>>({
  create: currentTitles,
  update: (titles, tr) => tr.effects.reduce((value, effect) => (effect.is(setTitles) ? effect.value : value), titles),
});

const sameTitles = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((title) => b.has(title));

const followNoteList = ViewPlugin.define((view) => ({
  destroy: subscribeToNoteList(() => {
    const titles = currentTitles();
    if (!sameTitles(titles, view.state.field(noteTitles))) view.dispatch({ effects: setTitles.of(titles) });
  }),
}));

export const noteTitleTracking = [noteTitles, followNoteList];
