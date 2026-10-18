import { cn } from "cn";
import { Link } from "../../../shared/ui/link";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shared/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "../../../shared/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { SETTING_IDS } from "../model/settings-search";
import { modelGroups, storageAreas, type ModelGroup, type StorageArea } from "../model/storage-areas";
import { refreshStorageUsage, useStorageUsage } from "../model/storage-usage";
import { SettingsGroup } from "./settings-group";
import { TrashSummary } from "./trash-summary";
import { meterPercent, UsageMeter } from "./usage-meter";

const MIN_SEGMENT_PX = 2;

const SMALLEST_PERCENT = 0.01;
const percentFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function percent(bytes: number, total: number) {
  const value = meterPercent(bytes, total);
  if (value > 0 && value < SMALLEST_PERCENT) return `<${percentFormat.format(SMALLEST_PERCENT)}%`;
  return `${percentFormat.format(value)}%`;
}

function Size({ bytes }: { bytes: number }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(bytes)}</span>;
}

function SegmentedBar({ areas, total }: { areas: StorageArea[]; total: number }) {
  return (
    <div
      className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Storage by area: ${formatBytes(total)} shown`}
    >
      {areas.map((area) => (
        <Tooltip key={area.key} trackCursorAxis="x">
          <TooltipTrigger
            render={<span />}
            delay={0}
            className={cn("h-full", area.fill)}
            style={{ flexGrow: area.bytes, flexBasis: 0, minWidth: MIN_SEGMENT_PX }}
          />
          <TooltipContent>
            {area.label}: {formatBytes(area.bytes)} ({percent(area.bytes, total)})
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function StorageChart({ areas }: { areas: StorageArea[] }) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const visibleAreas = areas.filter((area) => !hiddenKeys.includes(area.key));
  const total = visibleAreas.reduce((sum, area) => sum + area.bytes, 0);

  return (
    <div className="flex flex-col gap-3 px-(--card-spacing)">
      <SegmentedBar areas={visibleAreas} total={total} />
      <p role="status" className="text-xs text-muted-foreground">
        {visibleAreas.length === 0 ? "No categories selected." : `${formatBytes(total)} shown.`} Select categories to
        filter the bar.
      </p>
      <ToggleGroup
        multiple
        aria-label="Storage categories shown in the bar"
        value={visibleAreas.map((area) => area.key)}
        onValueChange={(keys) =>
          setHiddenKeys(areas.filter((area) => !keys.includes(area.key)).map((area) => area.key))
        }
        className="grid w-full grid-cols-2 gap-x-6 gap-y-1.5"
      >
        {areas.map((area) => (
          <ToggleGroupItem
            key={area.key}
            value={area.key}
            className="min-w-0 justify-start gap-2 aria-[pressed=false]:opacity-50"
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", area.fill)} />
            <span className="truncate group-aria-[pressed=false]/toggle:line-through">{area.label}</span>
            <span className="ml-auto">
              <Size bytes={area.bytes} />
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function WarningPopover({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger openOnHover render={<Button variant="warning" size="icon-xs" aria-label="About this size" />}>
        <TriangleAlert />
      </PopoverTrigger>
      <PopoverContent className="w-64">{text}</PopoverContent>
    </Popover>
  );
}

function AreaSection({ area }: { area: StorageArea }) {
  const showMeters = area.parts.length > 1;

  return (
    <SettingsGroup
      name={`storage-${area.key}`}
      title={area.label}
      leading={<span aria-hidden className={cn("size-2 rounded-full", area.fill)} />}
      actions={
        <span className="flex items-center gap-1">
          {area.warning && <WarningPopover text={area.warning} />}
          <Size bytes={area.bytes} />
        </span>
      }
    >
      <Card size="sm">
        {area.description && <p className="px-(--card-spacing) text-xs text-muted-foreground">{area.description}</p>}
        <ul className="flex flex-col gap-3 px-(--card-spacing)">
          {area.parts.map((part) => (
            <li key={part.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="truncate">{part.label}</span>
                {part.count !== undefined && <span className="text-muted-foreground tabular-nums">{part.count}</span>}
                <span className="ml-auto">
                  <Size bytes={part.bytes} />
                </span>
              </div>
              {showMeters && (
                <UsageMeter
                  value={part.bytes}
                  max={area.bytes}
                  valueText={`${percent(part.bytes, area.bytes)} of ${area.label}`}
                  fill={area.fill}
                  track={area.track}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </SettingsGroup>
  );
}

function ModelGroupRows({ group }: { group: ModelGroup }) {
  return (
    <li className="flex flex-col gap-1.5 px-(--card-spacing)">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">{group.label}</span>
        <Link href={`#${group.manage.href}`} size="sm" className="h-auto px-0 text-xs" aria-label={group.manage.label}>
          Manage
        </Link>
        <span className="ml-auto">
          <Size bytes={group.bytes} />
        </span>
      </div>
      <ul className="flex flex-col gap-1 border-l pl-3">
        {group.parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{part.label}</span>
            <span className="ml-auto">
              <Size bytes={part.bytes} />
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ModelsSection({ groups }: { groups: ModelGroup[] }) {
  const total = groups.reduce((sum, group) => sum + group.bytes, 0);
  return (
    <SettingsGroup
      name="storage-models"
      title="Downloaded models"
      actions={total > 0 ? <Size bytes={total} /> : undefined}
    >
      <Card id={SETTING_IDS.storageModels} size="sm">
        <p className="px-(--card-spacing) text-xs text-muted-foreground">
          Models are kept apart from your notes and aren&apos;t counted in the app size. They stay until you delete
          them.
        </p>
        {groups.length === 0 ? (
          <p className="px-(--card-spacing) text-xs">No models downloaded.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => (
              <ModelGroupRows key={group.key} group={group} />
            ))}
          </ul>
        )}
      </Card>
    </SettingsGroup>
  );
}

export function StorageSection() {
  const { usage, loading } = useStorageUsage();
  useMountEffect(refreshStorageUsage);
  const areas = usage ? storageAreas(usage, import.meta.env.DEV) : [];
  const total = areas.reduce((sum, area) => sum + area.bytes, 0);

  return (
    <>
      <SettingsGroup
        name="storage"
        title="App size"
        actions={
          <Button variant="ghost" size="sm" disabled={loading} onClick={refreshStorageUsage}>
            Refresh
          </Button>
        }
      >
        {usage && (
          <Card id={SETTING_IDS.storage} size="sm">
            <CardHeader>
              <CardTitle>App and data</CardTitle>
              <CardDescription className="truncate select-text">{usage.folder}</CardDescription>
              <CardAction className="self-center">
                <span className="text-sm font-medium">{formatBytes(total)}</span>
              </CardAction>
            </CardHeader>
            <StorageChart areas={areas} />
          </Card>
        )}
      </SettingsGroup>
      <TrashSummary />
      {areas.map((area) => (
        <AreaSection key={area.key} area={area} />
      ))}
      {usage && <ModelsSection groups={modelGroups(usage)} />}
    </>
  );
}
