import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/shared/config/site";

export function ClosingSection() {
  return (
    <section aria-labelledby="closing-title" className="relative mt-32 overflow-hidden sm:mt-44">
      <div className="grid-backdrop grid-backdrop-centered" aria-hidden="true" />
      <div className="container-page relative flex flex-col items-center pt-28 pb-32 text-center">
        <h2 id="closing-title" className="display-2 max-w-[16ch]">
          Try it on your own notes
        </h2>
        <p className="lead mt-5 max-w-[40ch]">Compose Notes AI runs on Linux, Windows and macOS.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/download" className="btn-primary">
            Download
          </Link>
          <a href={REPO_URL} className="btn-secondary">
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
