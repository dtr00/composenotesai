import { ChevronDown } from "lucide-react";
import { AI_CONTEXT_SIZES, tokenCount } from "../../../entities/settings/model/setting-limits";
import { updateAiSettings, useSettings } from "../../../entities/settings/model/settings-store";
import { Button } from "../../../shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { chooseChatModel, modelKey, useModelChoice, useModels } from "../model/models-store";

const setContextSize = (contextSize: number) => updateAiSettings({ contextSize });

function ContextSizeMenu() {
  const { contextSize } = useSettings().ai;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span className="flex-1">Context size</span>
        <span className="text-muted-foreground">{tokenCount(contextSize)}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>How much the model keeps in mind</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={contextSize} onValueChange={(value: number) => setContextSize(value)}>
            {AI_CONTEXT_SIZES.map((size) => (
              <DropdownMenuRadioItem key={size} value={size} closeOnClick>
                {tokenCount(size)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function ModelPicker() {
  const { sources } = useModels();
  const choice = useModelChoice();
  const picked = choice ? modelKey(choice.ref) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Model"
            className="max-w-48 min-w-0 gap-1 px-2 font-normal text-muted-foreground hover:text-foreground"
          />
        }
      >
        <span className="truncate">{choice?.model.name ?? "Choose a model"}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="max-h-96 min-w-56">
        <DropdownMenuRadioGroup
          value={picked}
          onValueChange={(value: string) => {
            const ref = sources
              .flatMap((source) => source.models.map((model) => ({ provider: source.provider, model: model.id })))
              .find((candidate) => modelKey(candidate) === value);
            if (ref) chooseChatModel(ref);
          }}
        >
          {sources.map((source) => (
            <DropdownMenuGroup key={source.provider}>
              <DropdownMenuLabel>{source.name}</DropdownMenuLabel>
              {source.models.map((model) => {
                const value = modelKey({ provider: source.provider, model: model.id });
                return (
                  <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                    <span className="flex-1 truncate">{model.name}</span>
                    {model.vision && <span className="text-muted-foreground">Sees images</span>}
                  </DropdownMenuRadioItem>
                );
              })}
              {source.models.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">{source.error ?? "No models yet"}</p>
              )}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <ContextSizeMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
