import { Cpu, Globe, Search, type LucideIcon } from "lucide-react";
import { SHOTS } from "../config/shots";

type Point = { icon: LucideIcon; title: string; body: string };

const POINTS: Point[] = [
  { icon: Search, title: "Finds the right notes", body: "It searches your library and reads only what it needs." },
  {
    icon: Cpu,
    title: "Runs on your machine",
    body: "A llama.cpp engine the app sets up, or Ollama and other compatible servers.",
  },
  { icon: Globe, title: "Offline by default", body: "Web search is available, and stays off until you turn it on." },
];

export function AiSection() {
  return (
    <section
      aria-labelledby="ai-title"
      className="container-page mt-32 grid scroll-mt-24 items-center gap-16 sm:mt-44 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div>
        <h2 id="ai-title" className="display-2 max-w-[14ch]">
          Ask your notes anything
        </h2>
        <p className="lead mt-5 max-w-[42ch]">
          The AI sits beside every note. It answers from your own writing, drafts and edits text, and every change can
          be undone.
        </p>
        <ul className="mt-10 grid gap-6">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-raised text-muted">
                <Icon className="size-[17px]" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[15px] font-[560] tracking-[-0.01em]">{title}</h3>
                <p className="mt-0.5 text-[15px] text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card flex h-[460px] justify-center px-8 pt-10 sm:h-[560px] sm:px-14">
        <div className="grid-backdrop opacity-60" aria-hidden="true" />
        <div className="frame fade-bottom h-fit w-full max-w-[400px]">
          <img {...SHOTS.chat} loading="lazy" />
        </div>
      </div>
    </section>
  );
}
