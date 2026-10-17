import { Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { LEAVE_SETTINGS_HOTKEY, SEARCH_SETTINGS_HOTKEY } from "../../../entities/settings/model/reserved-hotkeys";
import { VERTICAL_ARROW_STEPS } from "../../../shared/lib/arrow-steps";
import { navigate } from "../../../shared/lib/hash-router";
import { hotkeyFromEvent, sameHotkey } from "../../../shared/lib/hotkeys";
import { Input } from "../../../shared/ui/input";
import { Link } from "../../../shared/ui/link";
import { Shortcut } from "../../../shared/ui/shortcut";
import { leaveSettings } from "../model/settings-navigation";
import { revealSetting, searchSettings, type SettingsResult } from "../model/settings-search";
import { SETTINGS_SECTIONS, type SectionPath } from "../model/settings-sections";

const ITEM =
  "w-full justify-start aria-[current=page]:pointer-events-none aria-[current=page]:bg-foreground/8 aria-[current=page]:text-sidebar-accent-foreground";

function SectionLinks({ currentPath }: { currentPath: SectionPath }) {
  return SETTINGS_SECTIONS.map(({ path, label, Icon }) => (
    <li key={path}>
      <Link
        href={`#${path}`}
        variant="ghost"
        className={ITEM}
        aria-current={path === currentPath ? "page" : undefined}
        data-sidebar-item="open"
      >
        <Icon data-icon="inline-start" />
        {label}
      </Link>
    </li>
  ));
}

const RESULTS_ID = "settings-search-results";
const resultId = (key: string) => `settings-result-${key.replace(/[^a-z0-9-]/gi, "-")}`;
const keepInView = (item: HTMLAnchorElement | null) => item?.scrollIntoView({ block: "nearest" });

function openResult({ path, entry }: SettingsResult) {
  if (entry) revealSetting(entry);
  else navigate(path);
}

function SearchResults({ results, active }: { results: SettingsResult[]; active: number }) {
  if (results.length === 0) return <li className="px-2 py-1.5 text-xs text-muted-foreground">No settings found.</li>;
  return results.map((result, i) => (
    <li key={result.key}>
      <Link
        id={resultId(result.key)}
        ref={i === active ? keepInView : undefined}
        href={`#${result.path}`}
        variant="ghost"
        tabIndex={-1}
        data-active={i === active || undefined}
        className="w-full justify-start data-active:bg-foreground/8"
        onClick={(event) => {
          event.preventDefault();
          openResult(result);
        }}
      >
        {result.Icon && <result.Icon data-icon="inline-start" />}
        <span className="truncate">{result.label}</span>
        {result.detail && <span className="ml-auto shrink-0 pl-2 text-muted-foreground">{result.detail}</span>}
      </Link>
    </li>
  ));
}

const OPEN_POPUP = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function followPageKeys(container: HTMLDivElement) {
  const handle = (event: globalThis.KeyboardEvent) => {
    const pressed = hotkeyFromEvent(event);
    const search = container.querySelector("input");
    if (pressed && search && sameHotkey(pressed, SEARCH_SETTINGS_HOTKEY)) {
      event.preventDefault();
      search.focus();
      search.select();
    } else if (pressed && sameHotkey(pressed, LEAVE_SETTINGS_HOTKEY)) {
      if (event.defaultPrevented || document.querySelector(OPEN_POPUP)) return;
      event.preventDefault();
      leaveSettings();
    }
  };
  window.addEventListener("keydown", handle);
  return () => window.removeEventListener("keydown", handle);
}

export function SettingsNav({ currentPath }: { currentPath: SectionPath }) {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const [active, setActive] = useState(0);
  const results = searching ? searchSettings(query) : [];
  const activeResult: SettingsResult | undefined = results[Math.min(active, results.length - 1)];

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!searching) return;
    const offset = VERTICAL_ARROW_STEPS[event.key];
    if (offset) {
      event.preventDefault();
      event.stopPropagation();
      setActive(Math.min(results.length - 1, Math.max(0, active + offset)));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
    } else if (event.key === "Enter" && activeResult) {
      openResult(activeResult);
    }
  };

  return (
    <div ref={followPageKeys} className="flex min-h-0 flex-col gap-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          data-sidebar-item
          aria-label="Search settings"
          placeholder="Search"
          role="combobox"
          aria-expanded={searching}
          aria-controls={RESULTS_ID}
          aria-activedescendant={activeResult && resultId(activeResult.key)}
          className="peer pr-14 pl-7"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKey}
        />
        <Shortcut
          hotkey={SEARCH_SETTINGS_HOTKEY}
          className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 peer-focus:hidden"
        />
      </div>
      <ul id={RESULTS_ID} className="-m-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1">
        {searching ? (
          <SearchResults results={results} active={Math.min(active, results.length - 1)} />
        ) : (
          <SectionLinks currentPath={currentPath} />
        )}
      </ul>
    </div>
  );
}
