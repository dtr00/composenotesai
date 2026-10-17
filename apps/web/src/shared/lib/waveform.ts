import type { Shader } from "@/shared/lib/dither";

const BAR = 4;

export const voiceWave: Shader = (width, height, seconds) => (x, y) => {
  if (x % BAR === BAR - 1) return 0;
  const bar = Math.floor(x / BAR);
  const position = (bar * BAR) / width;
  const envelope = Math.sin(Math.PI * position) ** 0.7;
  const level = Math.abs(Math.sin(bar * 0.37 + seconds * 2.4) * Math.sin(bar * 0.11 - seconds * 1.1));
  const amplitude = envelope * (0.12 + 0.72 * level);
  const distance = Math.abs(y - height / 2) / (height / 2);
  return distance > amplitude ? 0 : 0.95 - (distance / amplitude) * 0.5;
};
