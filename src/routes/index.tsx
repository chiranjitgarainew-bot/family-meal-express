import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Defer auth decision to client — supabase session is in localStorage.
    // We render a small client splash that redirects.
  },
  component: SplashRedirect,
});

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import heroImg from "@/assets/hero-thali.jpg";

function SplashRedirect() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    nav({ to: user ? "/home" : "/login", replace: true });
  }, [loading, user, nav]);

  return (
    <div className="phone-shell relative overflow-hidden">
      <div className="gradient-hero absolute inset-0" aria-hidden />
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
        <img
          src={heroImg}
          alt=""
          width={200}
          height={200}
          className="h-44 w-44 rounded-full object-cover shadow-elevated ring-4 ring-background/60"
        />
        <h1 className="mt-8 font-display text-4xl text-foreground">Family Food Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Home-cooked daily meals · delivered</p>
        <div className="mt-10 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

// silence unused
void redirect;
