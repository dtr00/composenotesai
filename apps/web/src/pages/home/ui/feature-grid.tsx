import type { ReactNode } from "react";
import { DitherCanvas } from "@/shared/ui/dither-canvas";
import { voiceWave } from "@/shared/lib/waveform";
import type { Shot } from "@/shared/config/shot";
import { SHOTS } from "../config/shots";

type FeatureCardProps = {
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
};

function FeatureCard({ title, body, visual, className = "" }: FeatureCardProps) {
  return (
    <article className={`card flex flex-col ${className}`}>
      <div className="fade-bottom relative h-[260px] overflow-hidden sm:h-[300px]">{visual}</div>
      <div className="relative px-7 pt-2 pb-7">
        <h3 className="text-[17px] font-[560] tracking-[-0.012em]">{title}</h3>
        <p className="mt-1.5 max-w-[46ch] text-[15px] text-muted">{body}</p>
      </div>
    </article>
  );
}

function ShotVisual({ shot, width }: { shot: Shot; width: string }) {
  return (
    <div className="frame absolute top-8 left-8 rounded-r-none rounded-b-none" style={{ width }}>
      <img {...shot} loading="lazy" />
    </div>
  );
}

const PLAIN_KB = 21;
const STORED_KB = 3;

function Squares({ count, className }: { count: number; className: string }) {
  return Array.from({ length: count }, (_, i) => <span key={i} className={className} />);
}

function StorageVisual() {
  return (
    <>
      <div className="absolute inset-x-7 top-8 flex items-end gap-6">
        <div>
          <div className="grid w-fit grid-cols-7 gap-1">
            <Squares count={PLAIN_KB} className="storage-dither size-[18px] rounded-[3px]" />
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            Plain text <span className="font-[560] text-text tabular-nums">20.8 KB</span>
          </p>
        </div>
        <div>
          <div className="grid w-fit grid-cols-1 gap-1">
            <Squares count={STORED_KB} className="size-[18px] rounded-[3px] bg-accent" />
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            Stored <span className="font-[560] text-accent tabular-nums">3 KB</span>
          </p>
        </div>
      </div>
      <div className="frame absolute top-[150px] left-7 w-[min(720px,120%)] rounded-r-none rounded-b-none">
        <img {...SHOTS.storage} loading="lazy" />
      </div>
    </>
  );
}

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-title" className="container-page mt-32 sm:mt-44">
      <h2 id="features-title" className="display-2 max-w-[18ch]">
        Write, sketch and talk in one small app
      </h2>
      <div className="mt-12 grid gap-4 lg:grid-cols-6">
        <FeatureCard
          className="lg:col-span-4"
          title="Markdown that stays out of the way"
          body="A clean, fast editor for everything from quick thoughts to long documents."
          visual={<ShotVisual shot={SHOTS.editor} width="min(900px, 135%)" />}
        />
        <FeatureCard
          className="lg:col-span-2"
          title="Dictate from anywhere"
          body="Say it out loud and it becomes a note, from anywhere on your computer."
          visual={
            <DitherCanvas
              shader={voiceWave}
              className="absolute inset-x-6 top-1/2 h-[150px] w-[calc(100%-48px)] -translate-y-1/2 [--ink:var(--color-text)]"
            />
          }
        />
        <FeatureCard
          className="lg:col-span-3"
          title="Sketch next to your notes"
          body="Draw diagrams and sketches right alongside your notes."
          visual={<ShotVisual shot={SHOTS.drawing} width="min(620px, 112%)" />}
        />
        <FeatureCard
          className="lg:col-span-3"
          title="Small on purpose"
          body="Your notes take up almost no space, and the app stays light."
          visual={<StorageVisual />}
        />
      </div>
    </section>
  );
}
