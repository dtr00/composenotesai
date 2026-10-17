import { FolderPlus, Globe, PencilRuler, SquarePen } from "lucide-react";
import { isDrawing } from "../../entities/note/lib/note-format";
import { useHotkey } from "../../entities/settings/model/keybindings";
import { BrowserPane } from "../../features/browser/ui/browser-pane";
import { PanelBackground } from "../../features/panel-background/ui/panel-background";
import { openBrowserTab } from "../../features/tabs/model/tabs-store";
import { Button } from "../../shared/ui/button";
import { Shortcut } from "../../shared/ui/shortcut";
import { createAndOpenExcalidraw, createAndOpenNote, useNotes } from "./model/notes-store";
import { useNotesView, type NotesView } from "./model/notes-view";
import { createAndRenameFolder } from "./model/tree-store";
import { DeleteDialog } from "./ui/delete-dialog";
import { FolderPage } from "./ui/folder-page";
import { MediaPage } from "./ui/media-page";
import { NewTabHill } from "./ui/new-tab-hill";
import { ExcalidrawEditor } from "./ui/excalidraw-editor";
import { NoteEditor } from "./ui/note-editor";
import { NoteToolbar } from "./ui/note-toolbar";
import { NotesSidebar } from "./ui/notes-sidebar";

function NewTabActions() {
  const { creating } = useNotes();
  const newNoteHotkey = useHotkey("newNote");
  const newExcalidrawHotkey = useHotkey("newExcalidrawNote");
  const openBrowserHotkey = useHotkey("openBrowser");

  return (
    <NewTabHill>
      <Button
        variant="ghost"
        size="lg"
        className="justify-start"
        onClick={() => void createAndOpenNote()}
        disabled={creating}
      >
        <SquarePen data-icon="inline-start" />
        New note
        <Shortcut hotkey={newNoteHotkey} className="ml-auto pl-2" />
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="justify-start"
        disabled={creating}
        onClick={() => void createAndOpenExcalidraw()}
      >
        <PencilRuler data-icon="inline-start" />
        New Excalidraw note
        <Shortcut hotkey={newExcalidrawHotkey} className="ml-auto pl-2" />
      </Button>
      <Button variant="ghost" size="lg" className="justify-start" onClick={() => void createAndRenameFolder()}>
        <FolderPlus data-icon="inline-start" />
        New folder
      </Button>
      <Button variant="ghost" size="lg" className="justify-start" onClick={openBrowserTab}>
        <Globe data-icon="inline-start" />
        Open browser
        <Shortcut hotkey={openBrowserHotkey} className="ml-auto pl-2" />
      </Button>
    </NewTabHill>
  );
}

function PageContent({ view }: { view: Exclude<NotesView, { kind: "web" | "browser" }> }) {
  switch (view.kind) {
    case "folder":
      return <FolderPage id={view.id} />;
    case "media":
      return <MediaPage key={view.id} id={view.id} />;
    case "note":
      return <NoteEditor key={view.note.id} note={view.note} />;
    case "empty":
      return <NewTabActions />;
  }
}

function NotesBody({ view }: { view: NotesView }) {
  switch (view.kind) {
    case "web":
      return <BrowserPane key={view.tab} tab={view.tab} url={view.url} />;
    case "browser":
      return <div className="flex-1" />;
    default:
      if (view.kind === "note" && isDrawing(view.note.format))
        return <ExcalidrawEditor key={view.note.id} note={view.note} />;
      return (
        <div className="flex min-h-0 flex-1 flex-col px-8 pt-2 pb-6">
          <PageContent view={view} />
        </div>
      );
  }
}

export function NotesPage() {
  const view = useNotesView();

  return (
    <div className="flex min-h-0 flex-1">
      <NotesSidebar />
      <main className="relative isolate flex min-w-0 flex-1 flex-col">
        <PanelBackground />
        <NoteToolbar />
        <NotesBody view={view} />
      </main>
      <DeleteDialog />
    </div>
  );
}
