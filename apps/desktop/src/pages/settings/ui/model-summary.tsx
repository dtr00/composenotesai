import { Trash2 } from "lucide-react";
import type { DownloadProgress } from "../../../shared/api/download";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { DownloadStatus } from "./download-status";

interface ModelSummaryProps {
  name: string;
  description: string;
  sizeBytes: number;
  installed: boolean;
  isDefault: boolean;
  progress: DownloadProgress | undefined;
  onDownload: () => void;
  onCancel: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

type ModelActionsProps = Pick<
  ModelSummaryProps,
  "name" | "installed" | "isDefault" | "onDownload" | "onSetDefault" | "onDelete"
>;

function ModelActions({ name, installed, isDefault, onDownload, onSetDefault, onDelete }: ModelActionsProps) {
  if (!installed)
    return (
      <Button variant="outline" size="sm" onClick={onDownload}>
        Download
      </Button>
    );
  return (
    <>
      {isDefault ? (
        <Badge variant="secondary">Default</Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={onSetDefault}>
          Set default
        </Button>
      )}
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Delete the ${name} model`} onClick={onDelete} />}
        >
          <Trash2 />
        </TooltipTrigger>
        <TooltipContent>Delete model</TooltipContent>
      </Tooltip>
    </>
  );
}

export function ModelSummary({ name, description, sizeBytes, progress, onCancel, ...actions }: ModelSummaryProps) {
  return (
    <>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(sizeBytes)}</span>
      <div className="flex shrink-0 items-center gap-2">
        {progress ? (
          <DownloadStatus label={`Downloading the ${name} model`} progress={progress} onCancel={onCancel} />
        ) : (
          <ModelActions name={name} {...actions} />
        )}
      </div>
    </>
  );
}
