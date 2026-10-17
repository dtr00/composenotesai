import { ArrowDownToLine } from "lucide-react";
import { PLATFORMS, type Platform } from "../config/builds";

export function PlatformList({ recommended }: { recommended: Platform | null }) {
  return (
    <section id="all-platforms" aria-label="All platforms" className="card scroll-mt-24 divide-y divide-line">
      {PLATFORMS.map(({ platform, name, summary, builds }) => (
        <div
          key={platform}
          className="relative flex flex-col gap-5 px-7 py-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="flex items-center gap-3 text-[17px] font-[560] tracking-[-0.012em]">
              {name}
              {platform === recommended && (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[12px] font-[500] text-accent">
                  Your system
                </span>
              )}
            </h2>
            <p className="mt-1 text-[15px] text-muted">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {builds.map((build) => (
              <a key={build.href} href={build.href} className="btn-secondary btn-small">
                <ArrowDownToLine className="size-[15px] text-muted" aria-hidden="true" />
                {build.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
