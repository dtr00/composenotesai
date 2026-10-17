import type { MediaType } from "../../../shared/api/notes";

export interface MediaDimensions {
  width: number;
  height: number;
  duration: number | null;
}

function measureVideo(src: string) {
  return new Promise<MediaDimensions | null>((resolve) => {
    const video = document.createElement("video");
    const finish = (result: MediaDimensions | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    video.onerror = () => finish(null);
    video.src = src;
  });
}

function measureImage(src: string) {
  return new Promise<MediaDimensions | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: null });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

const MEASURERS: Record<MediaType, (src: string) => Promise<MediaDimensions | null>> = {
  image: measureImage,
  video: measureVideo,
  document: () => Promise.resolve(null),
};

export const measureMedia = (src: string, mediaType: MediaType) => MEASURERS[mediaType](src);
