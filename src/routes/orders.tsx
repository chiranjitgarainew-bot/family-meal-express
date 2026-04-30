import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { inr, formatDate, type MealType } from "@/lib/cutoff";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My orders — Family Food Service" }] }),
  component: OrdersPage,
});

interface Order {
  id: string;
  delivery_date: string;
  meal_type: MealType;
  items: { name: string; qty: number; price: number }[];
  total_amount: number;
  status: string;
  payment_method: string;
  created_at: string;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  confirmed: "bg-success/15 text-success",
  preparing: "bg-warning/15 text-warning-foreground",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function OrdersPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
    enabled: !!user,
  });

  if (loading || !user) return <div className="phone-shell" />;

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="px-5 pt-10 pb-4">
        <h1 className="font-display text-3xl">My orders</h1>
        <p className="text-sm text-muted-foreground">Your meal history & upcoming deliveries</p>
      </header>

      <div className="flex-1 px-5 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders yet</p>
            <Link to="/home" className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-soft">
              Browse menu
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const Icon = o.meal_type === "lunch" ? Sun : Moon;
              return (
                <li key={o.id} className="rounded-2xl bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl gradient-warm text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{o.meal_type}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(o.delivery_date)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusColor[o.status] ?? "bg-muted"}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-border pt-3">
                    {o.items.map((it, idx) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{it.name} × {it.qty}</span>
                        <span>{inr(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground uppercase">{o.payment_method}</span>
                    <span className="font-display text-lg text-primary">{inr(Number(o.total_amount))}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
