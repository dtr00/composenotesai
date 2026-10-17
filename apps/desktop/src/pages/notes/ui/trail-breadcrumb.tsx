import { Fragment, type ReactNode } from "react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import { folderIndex } from "../../../entities/note/model/note-tree";
import type { Folder } from "../../../shared/api/notes";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../../shared/ui/breadcrumb";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { openFolderPage } from "../model/tree-store";

const MAX_SHOWN_FOLDERS = 2;
const CRUMB =
  "flex h-[25px] items-center rounded-md px-1.5 text-xs text-muted-foreground hover:bg-foreground/10 hover:text-foreground";

function FolderCrumb({ folder }: { folder: Folder }) {
  return (
    <BreadcrumbItem className="min-w-0 shrink">
      <Tooltip>
        <TooltipTrigger render={<button type="button" className={CRUMB} onClick={() => openFolderPage(folder.id)} />}>
          <span className="max-w-32 truncate">{folder.name}</span>
        </TooltipTrigger>
        <TooltipContent>{folder.name}</TooltipContent>
      </Tooltip>
    </BreadcrumbItem>
  );
}

function HiddenFolders({ folders }: { folders: Folder[] }) {
  return (
    <BreadcrumbItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="size-[25px]" aria-label="Show hidden folders" />}
        >
          <BreadcrumbEllipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto">
          {folders.map((folder) => (
            <DropdownMenuItem key={folder.id} onClick={() => openFolderPage(folder.id)}>
              {folder.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

export function TrailBreadcrumb({ parentId, children }: { parentId: number | null; children: ReactNode }) {
  const path = folderIndex(useEntries()).trail(parentId);
  const collapsed = path.length > MAX_SHOWN_FOLDERS;
  const crumbs = collapsed ? [null, path[path.length - 1]] : path;

  return (
    <Breadcrumb className="ml-1 min-w-0">
      <BreadcrumbList className="flex-nowrap gap-0.5">
        {crumbs.map((folder) => (
          <Fragment key={folder?.id ?? "hidden"}>
            {folder ? <FolderCrumb folder={folder} /> : <HiddenFolders folders={path.slice(0, -1)} />}
            <BreadcrumbSeparator className="text-muted-foreground/60">/</BreadcrumbSeparator>
          </Fragment>
        ))}
        <BreadcrumbItem aria-current="page" className="min-w-0">
          {children}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
