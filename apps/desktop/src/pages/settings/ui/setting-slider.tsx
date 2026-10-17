import { cn } from "cn";
import { useState, type ComponentProps } from "react";
import { firstValue, Slider } from "../../../shared/ui/slider";

type LabelColumnWidth = "w-16" | "w-20";

interface SettingSliderProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  labelAfterValue?: boolean;
  labelColumnWidth?: LabelColumnWidth;
  thumbAlignment?: ComponentProps<typeof Slider>["thumbAlignment"];
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}

export function SettingSlider({
  id,
  label,
  value,
  unit,
  labelAfterValue,
  labelColumnWidth = "w-16",
  onPreview,
  onCommit,
  ...range
}: SettingSliderProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;

  return (
    <div id={id} className="flex flex-1 items-center gap-3">
      {!labelAfterValue && <span className={cn("shrink-0 text-xs", labelColumnWidth)}>{label}</span>}
      <Slider
        aria-label={label}
        {...range}
        value={shown}
        onValueChange={(next) => {
          setDraft(firstValue(next));
          onPreview(firstValue(next));
        }}
        onValueCommitted={(next) => {
          setDraft(null);
          onCommit(firstValue(next));
        }}
      />
      <span
        className={cn(
          "shrink-0 text-xs text-muted-foreground tabular-nums",
          labelAfterValue ? "whitespace-nowrap" : "w-10 text-right",
        )}
      >
        {shown}
        {unit}
      </span>
      {labelAfterValue && <span className="-ml-2 shrink-0 text-xs">{label}</span>}
    </div>
  );
}
