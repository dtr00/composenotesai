export type ToolArgs = Record<string, unknown>;

export function stringArg(args: ToolArgs, key: string): string | null {
  const value = args[key];
  return typeof value === "string" ? value : null;
}

export function idArg(args: ToolArgs, key: string): number | null {
  const value = args[key];
  const id = typeof value === "string" ? Number(value) : value;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

export function requiredString(args: ToolArgs, key: string): string {
  const value = stringArg(args, key);
  if (value === null) throw new Error(`Missing "${key}".`);
  return value;
}
