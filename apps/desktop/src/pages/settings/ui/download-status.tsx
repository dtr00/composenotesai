import type { DownloadProgress } from "../../../shared/api/download";
import { Button } from "../../../shared/ui/button";
import { Progress } from "../../../shared/ui/progress";

interface DownloadStatusProps {
  label: string;
  progress: DownloadProgress;
  onCancel?: () => void;
}

export function DownloadStatus({ label, progress, onCancel }: DownloadStatusProps) {
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100)) : 0;
  return (
    <>
      <Progress value={percent} aria-label={label} className="w-24" />
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
      {onCancel && (
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </>
  );
}
