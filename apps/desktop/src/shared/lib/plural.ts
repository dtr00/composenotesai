export const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const joinWithAnd = (parts: string[]) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts.join("");
