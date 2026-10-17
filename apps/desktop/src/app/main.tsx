import { domAnimation, LazyMotion } from "motion/react";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { loadNoteList } from "../entities/note/model/note-list-store";
import { listenForHotkeys } from "../entities/settings/model/keybindings";
import { startSettings } from "../entities/settings/model/settings-store";
import { noteIdIn } from "../features/ai-chat/lib/note-route";
import { startAiChat } from "../features/ai-chat/model/start-ai-chat";
import { toggleChat } from "../features/ai-chat/model/chat-panel";
import { forwardBrowserHotkeys } from "../features/browser/model/browser-hotkeys";
import { keepBrowsers, startBrowser } from "../features/browser/model/browser-store";
import { startPanelBackground } from "../features/panel-background/model/background-store";
import { toggleSidebar } from "../features/sidebar/model/sidebar-store";
import { watchForUpdates } from "../features/updater/model/update-store";
import {
  addTab,
  closeActiveTab,
  followPage,
  goBack,
  goForward,
  openBrowserTab,
  openTabPaths,
  openWebTab,
  startTabs,
  saveTabs,
  watchTabs,
} from "../features/tabs/model/tabs-store";
import { NOTE_TOOLS, readNoteForAi, revertAiChanges } from "../pages/notes/model/ai-note-tools";
import {
  createExcalidrawInNewTab,
  createNoteInNewTab,
  guardUnsavedClose,
  openNote,
} from "../pages/notes/model/notes-store";
import { listenForVoiceNotes } from "../pages/notes/model/voice-notes";
import { trackShiftHeld } from "../pages/notes/model/shift-preview";
import { listenForTrashHistory } from "../pages/notes/model/trash-history";
import { startTreeSelection } from "../pages/notes/model/tree-store";
import { openSettings, trackReturnPath } from "../pages/settings/model/settings-navigation";
import { revealVersionSetting } from "../pages/settings/model/settings-search";
import { loadMediaConfig } from "../shared/api/notes";
import { loadSettings } from "../shared/api/settings";
import { loadTabSession, type SavedTabSession } from "../shared/api/tab-session";
import { isMainWindow } from "../shared/api/windows";
import { isSettingsPath, matchEntry } from "../shared/config/routes";
import { errorMessage, showError } from "../shared/lib/error-toast";
import { currentPath, subscribeToPath } from "../shared/lib/hash-router";
import { trackWindowMaximized } from "../shared/lib/window-frame";
import { IconProvider } from "../shared/ui/icon-provider";
import "./styles.css";
import { App } from "./ui/app";
import { AppToaster } from "./ui/app-toaster";
import { TitleBar } from "./ui/title-bar";

const MOUSE_BACK_BUTTON = 3;
const MOUSE_FORWARD_BUTTON = 4;

const root = createRoot(document.getElementById("root")!);

function followMouseHistoryButtons() {
  window.addEventListener("mouseup", (event) => {
    if (event.button === MOUSE_BACK_BUTTON) goBack();
    else if (event.button === MOUSE_FORWARD_BUTTON) goForward();
    else return;
    event.preventDefault();
  });
}

function openNoteFromPath() {
  const path = currentPath();
  if (isSettingsPath(path)) return;
  const route = matchEntry(path);
  void openNote(route?.kind === "note" ? route.id : null);
}

const render = (screen: ReactNode) =>
  root.render(
    <StrictMode>
      <IconProvider>
        <LazyMotion features={domAnimation} strict>
          <div className="flex h-screen flex-col">{screen}</div>
          <AppToaster />
        </LazyMotion>
      </IconProvider>
    </StrictMode>,
  );

function reportUnrestoredTabs(error: unknown) {
  showError(`Couldn't restore your tabs: ${errorMessage(error)}`);
  return null;
}

const showStartError = (error: unknown) =>
  root.render(
    <p role="alert" className="p-8 text-destructive">
      Could not start: {String(error)}
    </p>,
  );

function openApp(tabSession: SavedTabSession | null) {
  loadNoteList();
  startTabs(tabSession, isMainWindow);
  guardUnsavedClose(saveTabs, { keepOpen: isMainWindow });
  if (isMainWindow) {
    listenForVoiceNotes();
    watchForUpdates(revealVersionSetting);
  }
  startBrowser({ visit: followPage, openTab: openWebTab });
  watchTabs(keepBrowsers);
  trackReturnPath();
  subscribeToPath(openNoteFromPath);
  openNoteFromPath();
  startAiChat({
    tools: NOTE_TOOLS,
    tabNoteIds: () => openTabPaths().flatMap((path) => noteIdIn(path) ?? []),
    readNote: readNoteForAi,
    revertNotes: revertAiChanges,
    openLink: openWebTab,
  });
  const hotkeys = {
    newNote: () => void createNoteInNewTab(),
    newExcalidrawNote: () => void createExcalidrawInNewTab(),
    newTab: addTab,
    openBrowser: openBrowserTab,
    closeTab: closeActiveTab,
    toggleSidebar,
    toggleChat,
    openSettings,
  };
  listenForHotkeys(hotkeys);
  forwardBrowserHotkeys(hotkeys);
  followMouseHistoryButtons();
  startTreeSelection();
  trackShiftHeld();
  listenForTrashHistory();
  render(<App />);
}

async function start() {
  trackWindowMaximized();
  const tabSession = isMainWindow ? loadTabSession().catch(reportUnrestoredTabs) : Promise.resolve(null);
  const [settings] = await Promise.all([loadSettings(), loadMediaConfig()]);
  startSettings(settings);
  void startPanelBackground();
  render(<TitleBar />);
  openApp(await tabSession);
}

start().catch(showStartError);
