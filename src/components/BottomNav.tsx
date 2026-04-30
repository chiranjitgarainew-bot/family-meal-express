import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingBag, ClipboardList, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAuth();
  const { count } = useCart();

  const items = [
    { to: "/home", label: "Menu", icon: Home },
    { to: "/cart", label: "Cart", icon: ShoppingBag, badge: count },
    { to: "/orders", label: "Orders", icon: ClipboardList },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Settings }] : []),
  ] as const;

  return (
    <nav className="sticky bottom-0 z-30 mt-8 border-t border-border bg-card/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-around px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/home" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                className={`relative mx-auto flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
                {"badge" in it && it.badge ? (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
