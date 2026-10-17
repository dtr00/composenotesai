import { useCallback } from "react";
import type { MediaSummary } from "../../../shared/api/notes";
import { mountDocx } from "../lib/docx-document";
import { mountPdf } from "../lib/pdf-document";
import { documentZoom, pressedZoom, subscribeZoom } from "../model/document-zoom";

const PDF_PAGES = "mx-auto flex w-[calc(min(100%,48rem)*var(--zoom))] flex-col gap-4";
const DOCX_PAGES =
  "mx-auto w-fit [zoom:var(--zoom)] [&_.docx-wrapper]:gap-4! [&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0! [&_.docx-wrapper>section.docx]:mb-0! [&_.docx-wrapper>section.docx]:rounded-sm [&_.docx-wrapper>section.docx]:shadow-none! [&_.docx-wrapper>section.docx]:outline [&_.docx-wrapper>section.docx]:outline-foreground/10";

interface Viewer {
  mount: (container: HTMLElement, id: number, onError: () => void) => () => void;
  className: string;
}

const VIEWERS: Partial<Record<string, Viewer>> = {
  "application/pdf": { mount: mountPdf, className: PDF_PAGES },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    mount: mountDocx,
    className: DOCX_PAGES,
  },
};

function attachZoom(pages: HTMLElement, id: number) {
  const scroller = pages.parentElement;
  const apply = () => {
    const zoom = String(documentZoom(id));
    if (!scroller || pages.style.getPropertyValue("--zoom") === zoom) return;
    const x = (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth;
    const y = (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
    pages.style.setProperty("--zoom", zoom);
    scroller.scrollLeft = x * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTop = y * scroller.scrollHeight - scroller.clientHeight / 2;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const zoom = pressedZoom(event);
    if (!zoom) return;
    event.preventDefault();
    zoom(id);
  };
  apply();
  const unsubscribe = subscribeZoom(apply);
  window.addEventListener("keydown", onKeyDown);
  return () => {
    unsubscribe();
    window.removeEventListener("keydown", onKeyDown);
  };
}

export function DocumentView({ media, onError }: { media: MediaSummary; onError: () => void }) {
  const viewer = VIEWERS[media.mime];
  const { id } = media;
  const mount = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !viewer) return;
      const unzoom = attachZoom(element, id);
      const unmount = viewer.mount(element, id, onError);
      return () => {
        unmount();
        unzoom();
      };
    },
    [viewer, id, onError],
  );

  if (!viewer) return <p className="m-auto text-muted-foreground">This document could not be shown.</p>;

  return (
    <div className="-mx-8 -mb-6 min-h-0 flex-1 overflow-auto px-8 pt-2 pb-6">
      <div ref={mount} className={viewer.className} />
    </div>
  );
}
