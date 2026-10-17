import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { refreshTrash, trashBytes, useTrash } from "../../../entities/note/model/trash-store";
import { describeCounts } from "../../../entities/note/lib/entry-counts";
import { EntryIcon } from "../../../entities/note/ui/entry-icon";
import type { TrashItem } from "../../../shared/api/notes";
import { MAX_TRASH_RETENTION_DAYS } from "../../../entities/settings/model/setting-limits";
import { updateSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { counted } from "../../../shared/lib/plural";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../shared/ui/alert-dialog";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { deleteTrashItem, emptyTrashForGood, restoreTrashItem } from "../model/trash-actions";
import { SettingsGroup } from "./settings-group";

const MINUTE_MS = 60_000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 24 * 60 * MINUTE_MS],
  ["hour", 60 * MINUTE_MS],
  ["minute", MINUTE_MS],
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function deletedAgo(deletedAt: number) {
  const elapsed = Date.now() - deletedAt;
  const [unit, size] = UNITS.find(([, ms]) => elapsed >= ms) ?? ["minute", MINUTE_MS];
  return `Deleted ${relative.format(-Math.floor(elapsed / size), unit)}`;
}

const DAY_MS = 24 * 60 * MINUTE_MS;

function removedIn(deletedAt: number, retentionDays: number) {
  if (retentionDays === 0) return null;
  const remaining = deletedAt + retentionDays * DAY_MS - Date.now();
  if (remaining <= 0) return "removed the next time the app starts";
  const [unit, size] = UNITS.find(([, ms]) => remaining >= ms) ?? ["minute", MINUTE_MS];
  return `removed ${relative.format(Math.ceil(remaining / size), unit)}`;
}

function TrashRow({ item }: { item: TrashItem }) {
  const { trashRetentionDays } = useSettings();
  const details = [
    deletedAgo(item.deletedAt),
    removedIn(item.deletedAt, trashRetentionDays),
    item.entryType === "folder" && describeCounts(item.counts),
  ];

  return (
    <li className="flex items-center gap-3 px-(--card-spacing)">
      <EntryIcon type={item.entryType} className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground">{details.filter(Boolean).join(", ")}</span>
      </div>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(item.bytes)}</span>
      <Button variant="ghost" size="sm" onClick={() => restoreTrashItem(item.id)}>
        Restore
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete “${item.name}” forever`}
              onClick={() => deleteTrashItem(item.id)}
            />
          }
        >
          <Trash2 />
        </TooltipTrigger>
        <TooltipContent>Delete forever</TooltipContent>
      </Tooltip>
    </li>
  );
}

function EmptyTrashButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" disabled={count === 0} onClick={() => setOpen(true)}>
        Empty trash
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Empty trash?</AlertDialogTitle>
          <AlertDialogDescription>
            {counted(count, "item")} will be deleted for good. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              emptyTrashForGood();
            }}
          >
            Empty trash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const parseDays = (text: string) => {
  const days = Number(text);
  return text.trim() !== "" && Number.isInteger(days) && days >= 0 && days <= MAX_TRASH_RETENTION_DAYS ? days : null;
};

function RetentionCard() {
  const { trashRetentionDays } = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(trashRetentionDays);
  const days = parseDays(text);
  const changed = days !== null && days !== trashRetentionDays;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed) return;
    updateSettings({ trashRetentionDays: days });
    setDraft(null);
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Delete items after</CardTitle>
        <CardDescription>Checked each time the app starts. Use 0 to keep items forever.</CardDescription>
        <CardAction className="self-center">
          <form className="flex items-center gap-2" onSubmit={save}>
            <Input
              type="text"
              inputMode="numeric"
              aria-label="Days to keep items in the trash"
              aria-invalid={days === null || undefined}
              className="w-20 tabular-nums"
              value={text}
              onChange={(event) => setDraft(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">days</span>
            <Button type="submit" variant="outline" disabled={!changed}>
              Save
            </Button>
          </form>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

export function TrashSection() {
  const { items } = useTrash();
  useMountEffect(() => void refreshTrash());
  const total = trashBytes(items);

  return (
    <SettingsGroup
      name="trash"
      title="Trash"
      actions={
        <>
          <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(total)}</span>
          <EmptyTrashButton count={items?.length ?? 0} />
        </>
      }
    >
      <RetentionCard />
      {items && (
        <Card size="sm">
          {items.length === 0 ? (
            <p className="px-(--card-spacing) text-xs text-muted-foreground">The trash is empty.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <TrashRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </SettingsGroup>
  );
}
