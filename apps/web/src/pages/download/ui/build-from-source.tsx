import { REPO_URL } from "@/shared/config/site";
import { CopyButton } from "@/shared/ui/copy-button";

const COMMANDS = `git clone ${REPO_URL}.git
cd composenotesai
bun install
bun run tauri build`;

export function BuildFromSource() {
  return (
    <section aria-labelledby="source-title" className="card p-7">
      <h2 id="source-title" className="text-[17px] font-[560] tracking-[-0.012em]">
        Build from source
      </h2>
      <p className="mt-1.5 text-[15px] text-muted">
        You need{" "}
        <a href="https://bun.sh" className="text-link">
          Bun
        </a>
        ,{" "}
        <a href="https://rustup.rs" className="text-link">
          Rust
        </a>{" "}
        and the{" "}
        <a href="https://tauri.app/start/prerequisites/" className="text-link">
          Tauri prerequisites
        </a>{" "}
        for your system.
      </p>
      <div className="relative mt-5 rounded-xl border border-line bg-canvas">
        <div className="absolute top-2 right-2">
          <CopyButton text={COMMANDS} label="Copy commands" />
        </div>
        <pre className="overflow-x-auto px-4 py-4 pr-12 font-mono text-[13.5px] leading-[1.75] text-muted">
          <code>{COMMANDS}</code>
        </pre>
      </div>
    </section>
  );
}
