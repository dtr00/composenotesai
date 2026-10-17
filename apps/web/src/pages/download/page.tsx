import { ArrowDownToLine } from "lucide-react";
import { APP_NAME } from "@/shared/config/site";
import { PLATFORMS } from "./config/builds";
import { usePlatform } from "./hooks/use-platform";
import { BuildFromSource } from "./ui/build-from-source";
import { PlatformList } from "./ui/platform-list";

export function DownloadPage() {
  const platform = usePlatform();
  const recommended = PLATFORMS.find((entry) => entry.platform === platform);

  return (
    <div className="relative">
      <div className="grid-backdrop" aria-hidden="true" />
      <section aria-labelledby="download-title" className="container-page relative pt-20 sm:pt-28">
        <h1 id="download-title" className="display-1 max-w-[14ch]">
          Download {APP_NAME}
        </h1>
        <div className="mt-9 flex flex-wrap gap-3">
          {recommended ? (
            <a href={recommended.builds[0].href} className="btn-primary">
              <ArrowDownToLine className="size-[17px]" aria-hidden="true" />
              Download for {recommended.name}
            </a>
          ) : (
            <a href="#all-platforms" className="btn-primary">
              <ArrowDownToLine className="size-[17px]" aria-hidden="true" />
              Choose your platform
            </a>
          )}
        </div>
      </section>
      <div className="container-page relative mt-16 grid gap-4 pb-32 sm:mt-20 sm:pb-40">
        <PlatformList recommended={platform} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <BuildFromSource />
          <section aria-labelledby="models-title" className="card p-7">
            <h2 id="models-title" className="text-[17px] font-[560] tracking-[-0.012em]">
              About AI models
            </h2>
            <p className="mt-1.5 text-[15px] text-muted">
              The app itself is small. AI and speech models download from inside the app when you choose to use them,
              and you pick which ones.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
