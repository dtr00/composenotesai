import { formatBytes } from "../../shared/lib/format-bytes";
import { Button } from "../../shared/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "../../shared/ui/progress";
import { useUpdate } from "./model/update-store";

export function UpdatePage({ onContinue }: { onContinue: () => void }) {
  const { version, downloaded, total, installing, error } = useUpdate();
  const percent = installing ? 100 : total ? (downloaded / total) * 100 : null;
  const size = total === null ? formatBytes(downloaded) : `${formatBytes(downloaded)} of ${formatBytes(total)}`;

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-xs flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-sm font-medium">Updating to version {version}</h1>
          <p className="text-xs text-muted-foreground">The app opens once the update is installed.</p>
        </div>
        {error ? (
          <>
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
            <Button variant="outline" className="self-start" onClick={onContinue}>
              Continue without updating
            </Button>
          </>
        ) : (
          <Progress value={percent} getAriaValueText={() => size}>
            <ProgressLabel>{installing ? "Installing" : "Downloading"}</ProgressLabel>
            <ProgressValue>{() => size}</ProgressValue>
          </Progress>
        )}
      </div>
    </main>
  );
}
