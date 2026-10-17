const extensionDot = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? dot : -1;
};

export function fileExtension(name: string): string | null {
  const dot = extensionDot(name);
  return dot === -1 ? null : name.slice(dot + 1).toLowerCase();
}

export function withoutExtension(name: string) {
  const dot = extensionDot(name);
  return dot === -1 ? name : name.slice(0, dot);
}
