import type { ReactNode } from "react";
import { openUrl } from "../../../shared/api/links";

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="whitespace-nowrap underline underline-offset-2 hover:text-foreground"
      onClick={(event) => {
        event.preventDefault();
        void openUrl(href);
      }}
    >
      {children}
    </a>
  );
}
