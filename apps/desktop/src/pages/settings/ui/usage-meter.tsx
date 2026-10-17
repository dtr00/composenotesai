import { cn } from "cn";

export const meterPercent = (value: number, max: number) => (max > 0 ? Math.min(100, (value / max) * 100) : 0);

interface UsageMeterProps {
  label?: string;
  value: number;
  max: number;
  valueText: string;
  fill: string;
  track: string;
}

export function UsageMeter({ label, value, max, valueText, fill, track }: UsageMeterProps) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn("h-1 w-full overflow-hidden rounded-full", track)}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${meterPercent(value, max)}%` }} />
    </div>
  );
}
