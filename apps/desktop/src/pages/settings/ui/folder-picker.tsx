import { ChevronDown, Folder, FolderRoot } from "lucide-react";
import { useEntries } from "../../../entities/note/model/note-list-store";
import { folderIndex } from "../../../entities/note/model/note-tree";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";

const TOP_LEVEL = "top-level";
const TOP_LEVEL_LABEL = "Top level";

function useFolderPaths() {
  const entries = useEntries();
  const { trail } = folderIndex(entries);
  const folders = entries.flatMap((entry) =>
    entry.kind === "folder"
      ? [
          {
            id: entry.id,
            path: trail(entry.id)
              .map((folder) => folder.name)
              .join(" / "),
          },
        ]
      : [],
  );
  return folders.sort((a, b) => a.path.localeCompare(b.path));
}

export function useFolderMissing(folderId: number | null) {
  const folders = useFolderPaths();
  return folderId !== null && !folders.some((folder) => folder.id === folderId);
}

interface FolderPickerProps {
  folderId: number | null;
  label: string;
  onChange: (folderId: number | null) => void;
}

export function FolderPicker({ folderId, label, onChange }: FolderPickerProps) {
  const folders = useFolderPaths();
  const chosen = folders.find((folder) => folder.id === folderId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="max-w-56 justify-start gap-2" aria-label={label} />}
      >
        {chosen ? <Folder /> : <FolderRoot />}
        <span className="truncate">{chosen?.path ?? TOP_LEVEL_LABEL}</span>
        <ChevronDown className="ml-auto text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-auto max-w-72">
        <DropdownMenuRadioGroup
          value={chosen ? String(chosen.id) : TOP_LEVEL}
          onValueChange={(value: unknown) => onChange(value === TOP_LEVEL ? null : Number(value))}
        >
          <DropdownMenuRadioItem value={TOP_LEVEL} closeOnClick>
            {TOP_LEVEL_LABEL}
          </DropdownMenuRadioItem>
          {folders.length > 0 && <DropdownMenuSeparator />}
          {folders.map((folder) => (
            <DropdownMenuRadioItem key={folder.id} value={String(folder.id)} closeOnClick>
              <span className="truncate">{folder.path}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
