import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { APP_NAME, REPO_URL } from "@/shared/config/site";
import { GlitchText, type GlitchHandle } from "@/shared/ui/glitch-text";

export function SiteHeader() {
  const glitch = useRef<GlitchHandle>(null);
  const play = () => glitch.current?.play();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link
          to="/"
          onPointerEnter={play}
          onFocus={play}
          className="flex items-center gap-2.5 text-[15px] font-[560] tracking-[-0.012em]"
        >
          <img src="/app-icon.svg" alt="" width={26} height={26} className="size-[26px]" />
          <GlitchText ref={glitch} className="max-[360px]:sr-only">
            {APP_NAME}
          </GlitchText>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6">
          <Link to="/product" className="nav-link hidden sm:inline">
            Product
          </Link>
          <a href={REPO_URL} className="nav-link hidden sm:inline">
            GitHub
          </a>
          <Link to="/download" className="btn-primary btn-small">
            Download
          </Link>
        </nav>
      </div>
    </header>
  );
}
