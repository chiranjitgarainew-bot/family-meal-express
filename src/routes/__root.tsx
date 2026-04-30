import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="phone-shell flex items-center justify-center px-6 py-20">
      <div className="text-center">
        <h1 className="font-display text-7xl text-primary">404</h1>
        <p className="mt-3 text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground shadow-soft">
          Back home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "theme-color", content: "#E89A3C" },
      { title: "Family Food Service — Daily home-cooked meals delivered" },
      { name: "description", content: "Order daily lunch & dinner thalis or pre-book meals in advance. Home-style Indian food delivered to your door." },
      { property: "og:title", content: "Family Food Service" },
      { property: "og:description", content: "Daily lunch & dinner home delivery, with advance bookings." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
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
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
