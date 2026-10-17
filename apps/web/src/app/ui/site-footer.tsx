import { Link } from "@tanstack/react-router";
import { APP_NAME, RELEASES_URL, REPO_URL } from "@/shared/config/site";
import type { Shader } from "@/shared/lib/dither";
import { DitherCanvas } from "@/shared/ui/dither-canvas";

const footerFade: Shader = (_width, height, seconds) => (x, y) => {
  const depth = y / height;
  const drift = Math.sin(x * 0.04 + seconds * 0.35) * Math.sin(x * 0.011 - y * 0.08 + seconds * 0.2);
  return depth ** 1.8 * 0.5 + drift * 0.08 * depth;
};

export function SiteFooter() {
  return (
    <footer className="relative isolate border-t border-line">
      <DitherCanvas
        shader={footerFade}
        className="pointer-events-none absolute inset-0 -z-10 size-full opacity-[0.18] [--ink:var(--color-accent)]"
      />
      <div className="container-page flex flex-col gap-10 py-12 sm:flex-row sm:items-start sm:justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[15px] font-[560] tracking-[-0.012em]">
          <img src="/app-icon.svg" alt="" width={22} height={22} className="size-[22px]" />
          {APP_NAME}
        </Link>
        <nav aria-label="Footer" className="flex gap-12 text-[14px]">
          <ul className="grid gap-2.5">
            <li>
              <Link to="/product" className="nav-link">
                Product
              </Link>
            </li>
            <li>
              <Link to="/download" className="nav-link">
                Download
              </Link>
            </li>
          </ul>
          <ul className="grid gap-2.5">
            <li>
              <a href={REPO_URL} className="nav-link">
                GitHub
              </a>
            </li>
            <li>
              <a href={RELEASES_URL} className="nav-link">
                Releases
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
