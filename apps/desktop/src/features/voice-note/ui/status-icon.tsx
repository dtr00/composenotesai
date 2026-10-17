import { Check, CircleAlert, Loader2, X } from "lucide-react";
import type { VoiceStatus } from "../../../shared/api/voice";

const ICON = "size-[15px] shrink-0";

export function StatusIcon({ state }: { state: VoiceStatus["state"] }) {
  switch (state) {
    case "recording":
      return <span aria-hidden className="mx-1 size-2 shrink-0 animate-pulse rounded-full bg-destructive" />;
    case "transcribing":
      return <Loader2 aria-hidden className={`${ICON} animate-spin`} />;
    case "saved":
      return <Check aria-hidden className={ICON} />;
    case "cancelled":
      return <X aria-hidden className={`${ICON} text-muted-foreground`} />;
    case "failed":
      return <CircleAlert aria-hidden className={`${ICON} text-destructive`} />;
  }
}
