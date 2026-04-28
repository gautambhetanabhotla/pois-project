import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary font-mono">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Route not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That assignment doesn't exist in the PoIS catalogue.
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PoIS — Interactive Cryptography Dashboard" },
      {
        name: "description",
        content:
          "Gruvbox-themed interactive dashboard for CS8.401 Principles of Information Security: 20 programming assignments with live demos and LaTeX specs.",
      },
      { name: "author", content: "PoIS Course" },
      { property: "og:title", content: "PoIS — Interactive Cryptography Dashboard" },
      {
        property: "og:description",
        content:
          "20 interactive cryptography demos covering OWFs, PRGs, RSA, Diffie–Hellman, Garbled Circuits and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PoIS — Interactive Cryptography Dashboard" },
      { name: "description", content: "Gruvbox Learning Hub is a React application for interactive programming assignment demonstrations." },
      { property: "og:description", content: "Gruvbox Learning Hub is a React application for interactive programming assignment demonstrations." },
      { name: "twitter:description", content: "Gruvbox Learning Hub is a React application for interactive programming assignment demonstrations." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6ecc8157-ff72-426a-9a57-164c6cb07360/id-preview-96569ae7--95237271-a0df-45a0-bc59-12dbe80bdf24.lovable.app-1776871031141.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6ecc8157-ff72-426a-9a57-164c6cb07360/id-preview-96569ae7--95237271-a0df-45a0-bc59-12dbe80bdf24.lovable.app-1776871031141.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
          <SidebarTrigger className="text-foreground" />
          <div className="terminal-divider w-6 hidden sm:block" />
          <span className="font-mono text-xs text-muted-foreground">
            <span className="text-gb-yellow">~/</span>
            <span className="text-gb-aqua">pois</span>
            <span className="text-muted-foreground">$ </span>
            <span className="text-foreground">interactive-crypto-dashboard</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/clique"
              className="hidden sm:inline-flex font-mono text-[11px] text-gb-aqua hover:text-primary"
            >
              ./clique
            </Link>
            <Link
              to="/assignments"
              className="hidden sm:inline-flex font-mono text-[11px] text-gb-yellow hover:text-primary"
            >
              ./assignments
            </Link>
          </div>
        </header>
        <main className="min-h-[calc(100vh-3rem)] bg-background">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
