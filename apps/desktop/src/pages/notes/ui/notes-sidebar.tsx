import { FolderPlus, ListChevronsDownUp, ListChevronsUpDown, PencilRuler, SquarePen } from "lucide-react";
import { useHotkey } from "../../../entities/settings/model/keybindings";
import { useEntries, useNoteListStatus } from "../../../entities/note/model/note-list-store";
import { Sidebar } from "../../../features/sidebar/ui/sidebar";
import { SidebarPanel } from "../../../features/sidebar/ui/sidebar-panel";
import { matchEntry } from "../../../shared/config/routes";
import { useHashPath } from "../../../shared/lib/hash-router";
import { Button } from "../../../shared/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../../../shared/ui/context-menu";
import { Shortcut } from "../../../shared/ui/shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { createAndOpenExcalidraw, createAndOpenNote, useNotes } from "../model/notes-store";
import { createAndRenameFolder, setAllFolders } from "../model/tree-store";
import { NoteTree } from "./note-tree";
import { SettingsLink } from "./settings-link";

function CollapseAllButton() {
  const folders = useEntries().filter((entry) => entry.kind === "folder");
  const collapse = folders.some((folder) => !folder.collapsed);
  const label = collapse ? "Collapse all folders" : "Expand all folders";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label={label}
            onClick={() => setAllFolders(collapse)}
            disabled={folders.length === 0}
          />
        }
      >
        {collapse ? <ListChevronsDownUp /> : <ListChevronsUpDown />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function NotesSidebar() {
  const { creating } = useNotes();
  const newNoteHotkey = useHotkey("newNote");
  const newExcalidrawHotkey = useHotkey("newExcalidrawNote");
  const current = matchEntry(useHashPath());
  const { loading, error } = useNoteListStatus();
  const empty = useEntries().length === 0 && !loading && !error;

  const handleNew = () => void createAndOpenNote();
  const handleNewFolder = () => void createAndRenameFolder();

  return (
    <Sidebar>
      <ContextMenu>
        <ContextMenuTrigger render={<SidebarPanel aria-label="Notes" footer={<SettingsLink />} />}>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="New note" onClick={handleNew} disabled={creating} />
                }
              >
                <SquarePen />
              </TooltipTrigger>
              <TooltipContent>
                New note
                <Shortcut hotkey={newNoteHotkey} />
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="icon" aria-label="New folder" onClick={handleNewFolder} />}
              >
                <FolderPlus />
              </TooltipTrigger>
              <TooltipContent>New folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="New Excalidraw note"
                    disabled={creating}
                    onClick={() => void createAndOpenExcalidraw()}
                  />
                }
              >
                <PencilRuler />
              </TooltipTrigger>
              <TooltipContent>
                New Excalidraw note
                <Shortcut hotkey={newExcalidrawHotkey} />
              </TooltipContent>
            </Tooltip>
            <CollapseAllButton />
          </div>
          {empty ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No notes yet</p>
          ) : (
            <NoteTree current={current} />
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleNew} disabled={creating}>
            New note
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void createAndOpenExcalidraw()} disabled={creating}>
            New Excalidraw note
          </ContextMenuItem>
          <ContextMenuItem onClick={handleNewFolder}>New folder</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Sidebar>
  );
}
