export function workedFor(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `Worked for ${seconds}s`;
  return rest === 0 ? `Worked for ${minutes}m` : `Worked for ${minutes}m ${rest}s`;
}
