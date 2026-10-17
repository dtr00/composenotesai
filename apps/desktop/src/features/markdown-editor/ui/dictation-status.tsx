import { cn } from "cn";
import { Loader2, X } from "lucide-react";

export type DictationState = "recording" | "transcribing" | "failed";

const ICON = "inline-block size-[15px] align-[-2px]";

export function DictationStatus({ state, label }: { state: DictationState; label: string }) {
  const failed = state === "failed";
  return (
    <span className={cn(failed && "text-destructive")}>
      {failed ? <X aria-hidden className={ICON} /> : <Loader2 aria-hidden className={cn(ICON, "animate-spin")} />}
      <span role={failed ? "alert" : "status"} className="ml-1.5">
        {label}
      </span>
    </span>
  );
}
