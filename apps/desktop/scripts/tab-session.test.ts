import assert from "node:assert/strict";
import { test } from "node:test";
import type { SavedTabSession } from "../src/shared/api/tab-session";
import { restoreSession, sessionSnapshot } from "../src/features/tabs/model/tab-session";

const session: SavedTabSession = {
  tabs: [
    { id: 1, entries: ["/"], index: 0, groupId: null },
    { id: 4, entries: ["/notes/1", "/settings", "/notes/2"], index: 1, groupId: null },
    { id: 6, entries: ["/"], index: 0, groupId: 2 },
    { id: 8, entries: ["/web/https%3A%2F%2Fexample.com"], index: 0, groupId: 2 },
    { id: 9, entries: ["/media/3"], index: 0, groupId: null },
    { id: 10, entries: ["/web/"], index: 0, groupId: null },
    { id: 11, entries: ["/folders/2", "/"], index: 1, groupId: null },
  ],
  groups: [{ id: 2, name: "Research", collapsed: true }],
  activeId: 4,
};

test("session retains every tab except ungrouped new-tab screens", () => {
  const saved = sessionSnapshot(session);
  assert.deepEqual(
    saved.tabs.map((tab) => tab.id),
    [4, 6, 8, 9, 10],
  );
  assert.deepEqual(restoreSession(saved, "/"), saved);
  assert.deepEqual(session.tabs[0].entries, ["/"]);
});

test("an omitted active tab falls back to a visible saved tab", () => {
  const saved = sessionSnapshot({ ...session, activeId: 1 });
  assert.equal(saved.activeId, null);
  assert.equal(restoreSession(saved, "/").activeId, 4);
});

test("collapsed groups remain collapsed when a fresh tab is needed", () => {
  const saved = sessionSnapshot({
    ...session,
    tabs: session.tabs.filter((tab) => tab.groupId !== null),
    activeId: null,
  });
  const restored = restoreSession(saved, "/");
  assert.deepEqual(restored.groups, saved.groups);
  assert.deepEqual(restored.tabs[restored.tabs.length - 1], { id: 9, entries: ["/"], index: 0, groupId: null });
  assert.deepEqual(sessionSnapshot(restored), saved);
});

test("an empty session opens one fresh tab without persisting it", () => {
  const restored = restoreSession({ tabs: [], groups: [], activeId: null }, "/");
  assert.equal(restored.tabs.length, 1);
  assert.deepEqual(sessionSnapshot(restored), { tabs: [], groups: [], activeId: null });
});

test("a secondary window starts on its requested path", () => {
  assert.deepEqual(restoreSession(null, "/notes/9"), {
    tabs: [{ id: 1, entries: ["/notes/9"], index: 0, groupId: null }],
    groups: [],
    activeId: 1,
  });
});
