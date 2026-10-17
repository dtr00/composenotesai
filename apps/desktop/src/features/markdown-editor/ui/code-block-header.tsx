import { LoaderCircle, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "../../../shared/ui/combobox";
import { CODE_LANGUAGES, type CodeLanguage } from "../lib/code-languages";

export const CODE_HEADER_CONTROL = "[data-code-control]";

export interface CodeBlockHeaderProps {
  language: CodeLanguage;
  editable: boolean;
  onLanguage: (id: string) => void;
  onPrettify: () => Promise<void>;
}

function LanguagePicker({ language, onLanguage }: Pick<CodeBlockHeaderProps, "language" | "onLanguage">) {
  const items = CODE_LANGUAGES.some((item) => item.id === language.id) ? CODE_LANGUAGES : [...CODE_LANGUAGES, language];
  return (
    <Combobox
      autoHighlight
      items={items}
      value={language}
      onValueChange={(next) => {
        if (next && next.id !== language.id) onLanguage(next.id);
      }}
      itemToStringLabel={(item: CodeLanguage) => item.label}
      isItemEqualToValue={(item: CodeLanguage, value: CodeLanguage) => item.id === value.id}
    >
      <ComboboxTrigger
        render={<Button variant="ghost" size="xs" className="text-muted-foreground" aria-label="Code language" />}
      >
        {language.label}
      </ComboboxTrigger>
      <ComboboxContent className="w-48">
        <ComboboxInput showTrigger={false} placeholder="Search languages" />
        <ComboboxEmpty>No languages found</ComboboxEmpty>
        <ComboboxList>
          {(item: CodeLanguage) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function PrettifyButton({ onPrettify }: Pick<CodeBlockHeaderProps, "onPrettify">) {
  const [busy, setBusy] = useState(false);
  const prettify = () => {
    setBusy(true);
    void onPrettify().finally(() => setBusy(false));
  };
  return (
    <Button variant="ghost" size="xs" className="text-muted-foreground" disabled={busy} onClick={prettify}>
      {busy ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
      Prettify
    </Button>
  );
}

export function CodeBlockHeader({ language, editable, onLanguage, onPrettify }: CodeBlockHeaderProps) {
  return (
    <div data-code-control className="flex h-7 items-center justify-between gap-2 px-1.5 font-sans">
      {editable ? (
        <LanguagePicker language={language} onLanguage={onLanguage} />
      ) : (
        <span className="px-2 text-[0.625rem] font-medium text-muted-foreground">{language.label}</span>
      )}
      {editable && language.parser && <PrettifyButton onPrettify={onPrettify} />}
    </div>
  );
}
