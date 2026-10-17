import type { ComponentProps } from "react";
import { MEDIA_LABELS } from "../../../entities/note/lib/media-labels";
import type { MediaSummary } from "../../../shared/api/notes";
import { withoutExtension } from "../../../shared/lib/file-extension";
import { commitMediaName } from "../model/tree-store";

type MediaNameInputProps = Omit<ComponentProps<"input">, "defaultValue" | "onFocus" | "onBlur" | "onKeyDown"> & {
  media: MediaSummary;
};

const selectStem = (input: HTMLInputElement) => input.setSelectionRange(0, withoutExtension(input.value).length);

export function MediaNameInput({ media, ...props }: MediaNameInputProps) {
  return (
    <input
      key={media.name}
      aria-label={`${MEDIA_LABELS[media.mediaType]} name`}
      spellCheck={false}
      {...props}
      defaultValue={media.name}
      onFocus={(e) => selectStem(e.currentTarget)}
      onBlur={(e) => {
        const input = e.currentTarget;
        void commitMediaName(media, input.value).then((stored) => {
          input.value = stored;
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.currentTarget.value = media.name;
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
    />
  );
}
