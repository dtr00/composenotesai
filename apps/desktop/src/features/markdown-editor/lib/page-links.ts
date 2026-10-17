import { Facet } from "@codemirror/state";

export type OpenPageLink = (title: string) => void;

export const pageLinkOpener = Facet.define<OpenPageLink, OpenPageLink | null>({
  combine: (openers) => openers[0] ?? null,
});
