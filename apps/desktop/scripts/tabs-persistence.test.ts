import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import type { SavedTabSession } from "../src/shared/api/tab-session";

test("saving waits for the latest changes and retries failed writes", async () => {
  const events = new EventTarget();
  const location = {
    hash: "",
    replace(hash: string) {
      this.hash = hash;
      queueMicrotask(() => events.dispatchEvent(new Event("hashchange")));
    },
  };
  Object.defineProperty(globalThis, "window", { value: Object.assign(events, { location }), configurable: true });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    value: (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(0));
      return 0;
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { value: () => {}, configurable: true });
  const writes: SavedTabSession[] = [];
  let releaseFirst: () => void = () => {};
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let fail = false;
  mockIPC(async (command, payload) => {
    assert.equal(command, "save_tab_session");
    if (fail) throw new Error("database unavailable");
    writes.push(structuredClone(payload?.session as SavedTabSession));
    if (writes.length === 1) await firstWrite;
  });
  try {
    const tabs = await import("../src/features/tabs/model/tabs-store");
    tabs.startTabs({ tabs: [], groups: [], activeId: null }, true);
    tabs.openTab("/notes/2");
    tabs.addTab();
    const group = tabs.groupTabs([3]);
    tabs.renameGroup(group, "Research");
    let finished = false;
    const closing = tabs.saveTabs().then(() => {
      finished = true;
    });
    await Promise.resolve();
    assert.equal(finished, false);
    releaseFirst();
    await closing;
    assert.deepEqual(writes[writes.length - 1], {
      tabs: [
        { id: 2, entries: ["/notes/2"], index: 0, groupId: null },
        { id: 3, entries: ["/"], index: 0, groupId: group },
      ],
      groups: [{ id: group, name: "Research", collapsed: false }],
      activeId: 3,
    });
    const idleSave = tabs.saveTabs();
    tabs.renameGroup(group, "Updated research");
    await idleSave;
    assert.equal(writes[writes.length - 1].groups[0].name, "Updated research");
    fail = true;
    tabs.closeAllTabs();
    await assert.rejects(tabs.saveTabs(), /database unavailable/);
    fail = false;
    await tabs.saveTabs();
    assert.deepEqual(writes[writes.length - 1], { tabs: [], groups: [], activeId: null });
  } finally {
    releaseFirst();
    clearMocks();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
  }
});
