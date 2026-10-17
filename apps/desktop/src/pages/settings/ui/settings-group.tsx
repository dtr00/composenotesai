import type { ReactNode } from "react";

interface SettingsGroupProps {
  name: string;
  title: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  headerRow?: boolean;
  children?: ReactNode;
}

export function SettingsGroup({ name, title, leading, actions, headerRow, children }: SettingsGroupProps) {
  const headingId = `${name}-heading`;
  const heading = (
    <h2 id={headingId} className="text-xs font-medium text-muted-foreground">
      {title}
    </h2>
  );
  const row = headerRow || leading !== undefined || actions !== undefined;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      {row ? (
        <div className="flex min-h-6 items-center gap-2">
          {leading}
          {heading}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}
