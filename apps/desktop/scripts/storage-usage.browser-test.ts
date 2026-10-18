import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { startSettings } from "../src/entities/settings/model/settings-store";
import { StorageSection } from "../src/pages/settings/ui/storage-section";
import type { StorageUsage } from "../src/shared/api/storage";
import "../src/app/styles.css";
import { checker, testSettings, waitFor } from "./browser-kit";

const storageUsage: StorageUsage = {
  folder: "/demo/Compose Notes AI",
  appBytes: 98_000_000,
  databaseBytes: 184_000,
  logBytes: 0,
  backgroundBytes: 0,
  settings: [{ key: "theme", group: "appearance", bytes: 563 }],
  notes: {
    notes: 3,
    folders: 1,
    textBytes: 24_000,
    noteBytes: 6_000,
    folderBytes: 500,
    media: 0,
    mediaBytes: 0,
    trashBytes: 0,
  },
  ai: { chats: 2, chatBytes: 48_000, skillBytes: 800 },
  webview: [{ name: "WebKitCache", bytes: 1_200 }],
  speechModels: [],
  languageModels: [],
  engineBytes: 0,
};

export async function testStorageUsage() {
  const { check, passed } = checker();
  const commands: string[] = [];
  mockIPC((command) => {
    commands.push(command);
    if (command === "storage_usage") return storageUsage;
    if (command === "list_trash") return [];
    throw new Error(`Unexpected command: ${command}`);
  });
  startSettings(testSettings({ theme: "dark" }));
  const container = document.createElement("div");
  container.style.cssText = "width:680px;display:flex;flex-direction:column;gap:24px";
  document.body.append(container);
  const root = createRoot(container);
  const toggles = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"));
  const bar = () => container.querySelector('[role="img"]');
  const toggle = (label: string) => {
    const button = toggles().find((item) => item.textContent?.includes(label));
    if (!button) throw new Error(`Missing category: ${label}`);
    flushSync(() => button.click());
    return button;
  };
  try {
    flushSync(() => root.render(createElement(StorageSection)));
    await waitFor(() => toggles().length === 6);
    check(bar()?.children.length === 6, "All storage categories are shown by default");
    const fullTotal = container.querySelector('[data-slot="card-action"]')?.textContent;
    const notesWidth = bar()?.children[1]?.getBoundingClientRect().width ?? 0;
    const app = toggle("Application");
    check(app.getAttribute("aria-pressed") === "false", "A hidden category is announced as unpressed");
    check(bar()?.children.length === 5, "Hiding Application removes its segment");
    check(
      (bar()?.children[0]?.getBoundingClientRect().width ?? 0) > notesWidth,
      "The bar rescales so smaller categories become visible",
    );
    check(
      container.querySelector('[data-slot="card-action"]')?.textContent === fullTotal &&
        container.textContent?.includes("180.9 KB shown."),
      "Filtering updates the shown subtotal and keeps the full app size",
    );
    check(container.querySelector("#storage-app-heading") !== null, "Hidden categories retain their storage details");
    const refresh = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Refresh");
    if (!refresh) throw new Error("Missing refresh button");
    const requests = commands.length;
    flushSync(() => refresh.click());
    await waitFor(() => commands.length > requests && !refresh.disabled);
    check(app.getAttribute("aria-pressed") === "false" && bar()?.children.length === 5, "Refresh preserves the filter");
    for (const button of toggles().filter((item) => item.getAttribute("aria-pressed") === "true")) {
      flushSync(() => button.click());
    }
    check(
      bar()?.children.length === 0 && container.textContent?.includes("No categories selected."),
      "Turning every category off leaves an empty bar with an explanation",
    );
    toggle("Notes");
    check(
      bar()?.children.length === 1 && container.textContent?.includes("6.3 KB shown."),
      "A single category can be isolated",
    );
    for (const button of toggles().filter((item) => item.getAttribute("aria-pressed") === "false")) {
      flushSync(() => button.click());
    }
    check(bar()?.children.length === 6, "Every category can be restored");
    check(
      commands.every((command) => ["storage_usage", "list_trash"].includes(command)),
      "Filtering only reads storage data",
    );
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    clearMocks();
  }
  return passed;
}
