import { useImperativeHandle, useRef, type Ref } from "react";
import { prefersReducedMotion } from "@/shared/lib/dither";
import { playGlitch } from "@/shared/lib/glitch";

export type GlitchHandle = { play: () => void };

type GlitchTextProps = { ref: Ref<GlitchHandle>; children: string; className?: string };

export function GlitchText({ ref, children, className = "" }: GlitchTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const playing = useRef(false);

  useImperativeHandle(ref, () => ({
    play() {
      if (!root.current || !text.current || !canvas.current || playing.current || prefersReducedMotion()) return;
      const element = root.current;
      playing.current = true;
      element.dataset.playing = "";
      playGlitch(text.current, canvas.current, () => {
        playing.current = false;
        delete element.dataset.playing;
      });
    },
  }));

  return (
    <span ref={root} className={`glitch ${className}`}>
      <span ref={text}>{children}</span>
      <canvas ref={canvas} aria-hidden="true" className="dither-canvas" />
    </span>
  );
}
