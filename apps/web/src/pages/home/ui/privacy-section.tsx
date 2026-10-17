import { CloudOff, EyeOff, UserX } from "lucide-react";
import { DitherCanvas } from "@/shared/ui/dither-canvas";
import { IconList, type IconItem } from "@/shared/ui/icon-list";
import { noteGraph } from "../lib/shaders";

const FACTS: IconItem[] = [
  { icon: UserX, label: "No account" },
  { icon: EyeOff, label: "No tracking" },
  { icon: CloudOff, label: "Works offline" },
];

export function PrivacySection() {
  return (
    <section
      aria-labelledby="privacy-title"
      className="container-page mt-32 grid items-center gap-12 sm:mt-44 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20"
    >
      <DitherCanvas
        shader={noteGraph}
        className="mx-auto aspect-square w-full max-w-[460px] [--ink:var(--color-text)]"
      />
      <div>
        <h2 id="privacy-title" className="display-2 max-w-[19ch]">
          Your notes never leave your computer
        </h2>
        <p className="lead mt-5 max-w-[42ch]">
          Your notes and the AI both live on your device, so everything stays private.
        </p>
        <IconList items={FACTS} className="mt-9 gap-y-4" />
      </div>
    </section>
  );
}
