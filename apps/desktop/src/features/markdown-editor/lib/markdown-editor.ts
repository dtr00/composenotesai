import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { deleteMarkupBackward, insertNewlineContinueMarkup } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { keymap, placeholder } from "@codemirror/view";
import { mediaAccept } from "../../../shared/config/media-types";
import { completionMenu } from "./completion-menu";
import { dictation } from "./dictation";
import { editorHotkeys } from "./editor-hotkeys";
import { formatToolbar } from "./format-toolbar";
import { inlineFormatting } from "./inline-format";
import { listIndent } from "./list-indent";
import { webLinkOpener, type OpenWebLink } from "./link-clicks";
import { linkPreviews } from "./link-preview";
import { liveMarkdown } from "./live-preview";
import { mediaDrop } from "./media-drop";
import { mediaInsertion, pickMedia, type MediaHost } from "./media-insert";
import { pageLinkOpener, type OpenPageLink } from "./page-links";
import { selectionClearing } from "./selection-clearing";
import { slashCommands } from "./slash-commands";
import { SLASH_HINT } from "./slash-hint";
import { wikiLinkSource } from "./wiki-link-completion";

export interface EditorHost {
  media: MediaHost;
  openPageLink: OpenPageLink;
  openWebLink: OpenWebLink;
}

export function markdownEditor({ media, openPageLink, openWebLink }: EditorHost): Extension {
  const slash = slashCommands(pickMedia(mediaAccept(), media.save));
  return [
    history(),
    keymap.of([
      { key: "Enter", run: insertNewlineContinueMarkup },
      { key: "Backspace", run: deleteMarkupBackward },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    liveMarkdown,
    inlineFormatting,
    editorHotkeys,
    dictation(),
    listIndent,
    selectionClearing,
    formatToolbar,
    slash.extension,
    completionMenu([slash.source, wikiLinkSource]),
    mediaDrop,
    linkPreviews,
    mediaInsertion(media),
    placeholder(SLASH_HINT),
    pageLinkOpener.of(openPageLink),
    webLinkOpener.of(openWebLink),
  ];
}
