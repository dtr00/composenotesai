import { Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useSettings } from "../../../entities/settings/model/settings-store";
import { webPath } from "../../../shared/config/routes";
import { navigate } from "../../../shared/lib/hash-router";
import { resolveAddress } from "../lib/address";
import { reloadBrowser } from "../model/browser-store";

interface AddressBarProps {
  tab: number;
  url: string | null;
}

export function AddressBar({ tab, url }: AddressBarProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const { searchEngine } = useSettings();

  const open = (input: string) => {
    const target = resolveAddress(input, searchEngine);
    if (target === null) return;
    if (target === url) reloadBrowser(tab);
    else navigate(webPath(target));
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") open(event.currentTarget.value);
    if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
  };

  return (
    <label className="mx-1 flex h-[25px] min-w-0 flex-1 items-center gap-1.5 rounded-md bg-foreground/5 px-2 text-muted-foreground focus-within:bg-muted focus-within:text-foreground focus-within:ring-1 focus-within:ring-ring/50">
      <Search className="size-3.5 shrink-0" />
      <input
        aria-label="Search or enter address"
        placeholder="Search or enter address"
        spellCheck={false}
        autoComplete="off"
        autoFocus={url === null}
        value={draft ?? url ?? ""}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          setDraft(event.target.value);
          event.target.select();
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={handleKey}
        className="h-full min-w-0 flex-1 truncate bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
