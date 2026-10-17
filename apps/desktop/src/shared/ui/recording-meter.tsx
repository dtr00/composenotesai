import { formatDuration } from "../lib/format-duration";
import type { RecordingMeter } from "../lib/recording-meter";
import { useStore } from "../lib/store";

const HEIGHT_PX = 16;
const MIN_BAR_PX = 2;
const GAIN = 1.5;

const barHeight = (peak: number) => Math.max(MIN_BAR_PX, Math.min(1, Math.sqrt(peak) * GAIN) * HEIGHT_PX);

export function RecordingMeterView({ meter }: { meter: RecordingMeter }) {
  const { levels, seconds } = useStore(meter.reading);
  return (
    <>
      <span className="text-muted-foreground tabular-nums">{formatDuration(seconds)}</span>
      <div aria-hidden className="ml-auto flex h-4 items-center gap-[2px]">
        {levels.map((peak, index) => (
          <span key={index} className="w-[2px] rounded-full bg-foreground/70" style={{ height: barHeight(peak) }} />
        ))}
      </div>
    </>
  );
}
