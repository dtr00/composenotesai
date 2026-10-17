import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/shared/config/site";
import { DitherCanvas } from "@/shared/ui/dither-canvas";
import { heroLight } from "../lib/shaders";
import { SHOTS } from "../config/shots";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="grid-backdrop" aria-hidden="true" />
      <div className="container-page relative pt-20 sm:pt-28">
        <h1 id="hero-title" className="display-1 enter max-w-[19ch]" style={delay(80)}>
          Your notes, composed with local AI agents
        </h1>
        <p className="lead enter mt-6 max-w-[44ch]" style={delay(160)}>
          Write and organize your notes, then ask the AI about them. It runs on your device and stays completely
          private.
        </p>
        <div className="enter mt-9 flex flex-wrap gap-3" style={delay(240)}>
          <Link to="/download" className="btn-primary">
            Download
          </Link>
          <a href={REPO_URL} className="btn-secondary">
            View on GitHub
          </a>
        </div>
      </div>
      <div className="container-page relative isolate mt-16 sm:mt-20">
        <DitherCanvas
          shader={heroLight}
          className="light-mask pointer-events-none absolute -top-28 left-1/2 -z-10 h-[260px] w-[110%] -translate-x-1/2 opacity-60 sm:-top-44 sm:h-[560px] [--ink:var(--color-accent)]"
        />
        <figure className="tilt-in fade-bottom relative" style={delay(300)}>
          <div className="frame">
            <img {...SHOTS.hero} fetchPriority="high" />
          </div>
        </figure>
      </div>
    </section>
  );
}
