import type { LucideIcon } from "lucide-react";

export type IconItem = { icon: LucideIcon; label: string };

export function IconList({ items, className = "" }: { items: IconItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-8 ${className}`}>
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2.5 text-[15px]">
          <Icon className="size-[17px] text-accent" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
