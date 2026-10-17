import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { useEntries, useFolder, useMedia, useNoteParentId } from "../../../entities/note/model/note-list-store";
import type { MediaSummary } from "../../../shared/api/notes";
import { MediaInfoButton } from "./media-info";
import { AddressBar } from "../../../features/browser/ui/address-bar";
import { ReloadButton } from "../../../features/browser/ui/reload-button";
import { HistoryButtons } from "../../../features/tabs/ui/history-buttons";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { useRenameFocus } from "../hooks/use-rename-focus";
import { mediaActionGroups, noteActionGroups } from "../model/note-actions";
import { useNotesView } from "../model/notes-view";
import { NoteActionItems, type MenuParts } from "./note-action-items";
import { TrailBreadcrumb } from "./trail-breadcrumb";
import { NoteTitleInput } from "./note-title-input";
import { MEDIA_LABELS } from "../../../entities/note/lib/media-labels";
import { MediaNameInput } from "./media-name-input";
import { canZoomIn, canZoomOut, resetZoom, useDocumentZoom, zoomIn, zoomOut } from "../model/document-zoom";

const TOOLBAR_BUTTON = "size-[25px]";
const TITLE_INPUT =
  "h-[25px] max-w-full min-w-0 field-sizing-content truncate rounded-md bg-transparent px-1.5 text-xs text-muted-foreground outline-none hover:bg-foreground/10 focus:bg-muted focus:text-foreground focus:ring-1 focus:ring-ring";

interface OptionsMenuProps {
  label: string;
  finalFocus: () => HTMLElement | boolean;
  children: ReactNode;
}

const DROPDOWN_PARTS: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

function NoteMenuItems({ id, rename }: { id: number; rename: () => void }) {
  const groups = noteActionGroups(id, useEntries(), rename, { includeOpenInTab: false });
  return <NoteActionItems groups={groups} parts={DROPDOWN_PARTS} />;
}

function MediaMenuItems({ media, rename }: { media: MediaSummary; rename: () => void }) {
  const groups = mediaActionGroups(media, useEntries(), rename, { includeOpenInTab: false });
  return <NoteActionItems groups={groups} parts={DROPDOWN_PARTS} />;
}

const ZOOM_STEP = "w-7 justify-center px-0 text-sm";

function DocumentZoomRow({ id }: { id: number }) {
  const zoom = useDocumentZoom(id);
  return (
    <>
      <DropdownMenuGroup aria-label="Zoom" className="flex items-center gap-0.5">
        <span className="mr-auto px-2 text-xs/relaxed">Zoom</span>
        <DropdownMenuItem
          aria-label="Zoom out"
          className={ZOOM_STEP}
          closeOnClick={false}
          disabled={!canZoomOut(zoom)}
          onClick={() => zoomOut(id)}
        >
          −
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label="Reset zoom"
          className="w-11 justify-center px-0 tabular-nums"
          closeOnClick={false}
          onClick={() => resetZoom(id)}
        >
          {Math.round(zoom * 100)}%
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label="Zoom in"
          className={ZOOM_STEP}
          closeOnClick={false}
          disabled={!canZoomIn(zoom)}
          onClick={() => zoomIn(id)}
        >
          +
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}

function OptionsMenu({ label, finalFocus, children }: OptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={TOOLBAR_BUTTON} aria-label={label} />}
      >
        <Ellipsis className="size-[15px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto" finalFocus={finalFocus}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OpenNoteControls({ id }: { id: number }) {
  const { input, requestRename, finalFocus } = useRenameFocus();
  const parentId = useNoteParentId(id);

  return (
    <>
      <TrailBreadcrumb parentId={parentId}>
        <NoteTitleInput ref={input} noteId={id} className={TITLE_INPUT} />
      </TrailBreadcrumb>
      <div className="ml-auto flex items-center gap-0.5">
        <OptionsMenu label="Note options" finalFocus={finalFocus}>
          <NoteMenuItems id={id} rename={requestRename} />
        </OptionsMenu>
      </div>
    </>
  );
}

function OpenMediaControls({ id }: { id: number }) {
  const { input, requestRename, finalFocus } = useRenameFocus();
  const media = useMedia(id);
  if (!media) return null;

  return (
    <>
      <TrailBreadcrumb parentId={media.parentId}>
        <MediaNameInput ref={input} media={media} className={TITLE_INPUT} />
      </TrailBreadcrumb>
      <div className="ml-auto flex items-center gap-0.5">
        <MediaInfoButton media={media} className={TOOLBAR_BUTTON} />
        <OptionsMenu label={`${MEDIA_LABELS[media.mediaType]} options`} finalFocus={finalFocus}>
          {media.mediaType === "document" && <DocumentZoomRow id={media.id} />}
          <MediaMenuItems media={media} rename={requestRename} />
        </OptionsMenu>
      </div>
    </>
  );
}

function FolderPageTrail({ id }: { id: number }) {
  const folder = useFolder(id);
  if (!folder) return null;
  return (
    <TrailBreadcrumb parentId={folder.parentId}>
      <span className="flex h-[25px] items-center px-1.5 text-xs text-muted-foreground">
        <span className="max-w-48 truncate">{folder.name}</span>
      </span>
    </TrailBreadcrumb>
  );
}

export function NoteToolbar() {
  const view = useNotesView();

  return (
    <div className="flex shrink-0 items-center gap-0.5 px-2 py-1.5 select-none">
      <HistoryButtons />
      {view.kind === "note" && <OpenNoteControls key={view.note.id} id={view.note.id} />}
      {view.kind === "folder" && <FolderPageTrail id={view.id} />}
      {view.kind === "media" && <OpenMediaControls key={view.id} id={view.id} />}
      {view.kind === "web" && (
        <>
          <ReloadButton tab={view.tab} />
          <AddressBar key={view.tab} tab={view.tab} url={view.url} />
        </>
      )}
      {view.kind === "browser" && <AddressBar key={view.tab} tab={view.tab} url={null} />}
    </div>
  );
}
