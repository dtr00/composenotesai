import { mediaFormats, type MediaType } from "../api/notes";
import { fileExtension } from "../lib/file-extension";

export const mediaAccept = (mediaType?: MediaType) =>
  mediaFormats()
    .filter((format) => mediaType === undefined || format.mediaType === mediaType)
    .flatMap(({ mime, extensions }) => [mime, ...extensions.map((extension) => `.${extension}`)])
    .join(",");

export const isMediaMime = (mime: string) => mediaFormats().some((format) => format.mime === mime);

export const mediaFormatLabel = (mime: string) => mediaFormats().find((format) => format.mime === mime)?.label;

export function isMediaFileName(name: string) {
  const extension = fileExtension(name);
  return extension !== null && mediaFormats().some((format) => format.extensions.includes(extension));
}
