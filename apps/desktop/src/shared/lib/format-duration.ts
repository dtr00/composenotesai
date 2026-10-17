export function formatDuration(seconds: number) {
  const whole = Math.round(seconds);
  const parts = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60];
  const [hours, ...rest] = parts;
  const shown = hours > 0 ? parts : rest;
  return shown.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0"))).join(":");
}
