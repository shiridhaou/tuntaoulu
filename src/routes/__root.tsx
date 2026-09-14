import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { CompetitionProvider } from "@/components/CompetitionProvider";
import { Toaster } from "@/components/ui/sonner";
import { InstallPwaPrompt } from "@/components/InstallPwaPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import { registerOfflineWorker } from "@/lib/pwa";
import "../styles.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "TunTaolu - نظام التحكيم" },
      { name: "description", content: "نظام التحكيم الرسمي للجامعة التونسية للووشو كونغ فو" },
      { name: "theme-color", content: "#0A192F" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TunTaolu" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "TunTaolu - نظام التحكيم" },
      { property: "og:description", content: "نظام التحكيم الرسمي للجامعة التونسية للووشو كونغ فو" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/icons/tuntaolu-icon.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "TunTaolu" },
      { name: "twitter:description", content: "نظام التحكيم الرسمي للجامعة التونسية للووشو كونغ فو" },
      { name: "twitter:image", content: "/icons/tuntaolu-icon.png" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", href: "/icons/tuntaolu-icon.png" },
      { rel: "apple-touch-icon", href: "/icons/tuntaolu-icon.png" },
      // Self-hosted fonts — no internet needed on a LAN / local server.
      { rel: "stylesheet", href: "/fonts/fonts.css" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <CompetitionProvider>
      <Outlet />
      <Toaster position="top-center" richColors />
      <InstallPwaPrompt />
    </CompetitionProvider>
  );
}
