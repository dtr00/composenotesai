import type { Entry, EntryOf, EntryRef, Folder } from "../../../shared/api/notes";

export interface TreeRow {
  entry: Entry;
  depth: number;
}

export const foldersFirst = (entries: Entry[]): Entry[] => [
  ...entries.filter((entry) => entry.kind === "folder"),
  ...entries.filter((entry) => entry.kind !== "folder"),
];

export const entryName = (entry: Entry) => (entry.kind === "note" ? entry.title : entry.name);

export function visibleRows(entries: Entry[]): TreeRow[] {
  const children = new Map<number | null, Entry[]>();
  for (const entry of entries) {
    const siblings = children.get(entry.parentId);
    if (siblings) siblings.push(entry);
    else children.set(entry.parentId, [entry]);
  }
  const rows: TreeRow[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const entry of children.get(parentId) ?? []) {
      rows.push({ entry, depth });
      if (entry.kind === "folder" && !entry.collapsed) visit(entry.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

export const isSameEntry = (a: EntryRef, b: EntryRef) => a.kind === b.kind && a.id === b.id;

export const isEntry = <K extends Entry["kind"]>(entry: Entry, ref: { kind: K; id: number }): entry is EntryOf<K> =>
  isSameEntry(entry, ref);

export const findEntry = <K extends Entry["kind"]>(entries: Entry[], ref: { kind: K; id: number }) =>
  entries.find((entry) => isEntry(entry, ref));

export const parentOf = (entries: Entry[], ref: EntryRef) => findEntry(entries, ref)?.parentId ?? null;

export const containsEntry = (refs: EntryRef[], entry: EntryRef) => refs.some((ref) => isSameEntry(ref, entry));

export const childrenOf = (entries: Entry[], parentId: number | null, except: EntryRef[] = []) =>
  entries.filter((entry) => entry.parentId === parentId && !containsEntry(except, entry));

export function folderIndex(entries: Entry[]) {
  const folders = new Map<number, Folder>();
  for (const entry of entries) if (entry.kind === "folder") folders.set(entry.id, entry);

  const trail = (folderId: number | null): Folder[] => {
    const path: Folder[] = [];
    for (let id = folderId; id !== null;) {
      const folder = folders.get(id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parentId;
    }
    return path;
  };

  const isWithin = (folderId: number | null, ancestor: EntryRef) =>
    ancestor.kind === "folder" && trail(folderId).some((folder) => folder.id === ancestor.id);

  return { trail, isWithin };
}

export function outermost(entries: Entry[], refs: EntryRef[]): EntryRef[] {
  const { isWithin } = folderIndex(entries);
  return refs.filter((ref) => !refs.some((other) => isWithin(parentOf(entries, ref), other)));
}

export function contentsOf(entries: Entry[], refs: EntryRef[]): Entry[] {
  const { isWithin } = folderIndex(entries);
  return entries.filter((entry) => !containsEntry(refs, entry) && refs.some((ref) => isWithin(entry.parentId, ref)));
}

export const titleKey = (title: string) => title.trim().toLowerCase();

export const notesIn = (entries: Entry[]): EntryOf<"note">[] =>
  entries.filter((entry): entry is EntryOf<"note"> => entry.kind === "note");

export const findNoteByTitle = (entries: Entry[], title: string) =>
  notesIn(entries).find((note) => titleKey(note.title) === titleKey(title));
