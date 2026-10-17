import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { LucideProvider } from "lucide-react";
import appCss from "@/app/styles.css?url";
import { PageTransition } from "@/app/ui/page-transition";
import { SiteFooter } from "@/app/ui/site-footer";
import { SiteHeader } from "@/app/ui/site-header";
import { APP_NAME, SITE_URL } from "@/shared/config/site";

const DESCRIPTION =
  "A note-taking app that keeps your notes, and the AI that helps with them, on your own computer. For Linux, Windows and macOS.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#08090a" },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: APP_NAME },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-text px-4 py-2 text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <LucideProvider strokeWidth={1.5} nonScalingStroke>
          <SiteHeader />
          <main id="main" className="flex-1 overflow-x-clip">
            {children}
          </main>
          <SiteFooter />
        </LucideProvider>
        <PageTransition />
        <Scripts />
      </body>
    </html>
  );
}
