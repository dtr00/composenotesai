import { readMedia } from "../../../shared/api/notes";

export function mountDocx(container: HTMLElement, id: number, onError: () => void) {
  let cancelled = false;
  const target = document.createElement("div");
  container.append(target);
  Promise.all([readMedia(id), import("docx-preview")])
    .then(([bytes, { renderAsync }]) =>
      renderAsync(bytes, target, undefined, { ignoreLastRenderedPageBreak: true, useBase64URL: true }),
    )
    .catch(() => {
      if (!cancelled) onError();
    });
  return () => {
    cancelled = true;
    target.remove();
  };
}
