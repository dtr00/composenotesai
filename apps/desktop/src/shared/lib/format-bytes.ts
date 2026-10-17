const UNITS = ["KB", "MB", "GB", "TB"];
const STEP = 1024;

const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (bytes < STEP) return `${bytes} B`;
  let value = bytes / STEP;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit++;
  }
  return `${decimal.format(value)} ${UNITS[unit]}`;
}
