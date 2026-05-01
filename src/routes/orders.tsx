import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, Moon, Package, Repeat2, Download, Star, FileDown, X, KeyRound, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { inr, formatDate, type MealType, isPastCutoff, DEFAULT_CUTOFFS, todayISO, canEditOrder } from "@/lib/cutoff";
import { downloadOrderInvoice, downloadSummary, type InvoiceOrder } from "@/lib/invoice";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My orders — Family Food Service" }] }),
  component: OrdersPage,
});

interface Order extends InvoiceOrder {
  meal_type: MealType;
  delivery_otp: string | null;
  otp_verified_at: string | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  confirmed: "bg-success/15 text-success",
  preparing: "bg-warning/15 text-warning-foreground",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function startOfWeekISO(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
function startOfMonthISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString().slice(0, 10);
}

function OrdersPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { replaceAll } = useCart();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (!loading && !user) nav({ to: "/login", replace: true }); }, [loading, user, nav]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("order_reviews").select("order_id").eq("user_id", user.id).then(({ data }) => {
      if (data) setReviewedIds(new Set(data.map((r) => r.order_id)));
    });
  }, [user, orders]);

  const last = orders?.[0];

  const repeat = (o: Order) => {
    if (isPastCutoff(todayISO(), o.meal_type, DEFAULT_CUTOFFS)) {
      toast.error(`${o.meal_type} cut-off has passed for today. Pick a future date in cart.`);
    }
    replaceAll(o.items.map((it) => ({
      id: (it as { id?: string }).id ?? `${o.id}-${it.name}`,
      name: it.name, price: it.price, qty: it.qty, meal_type: o.meal_type,
    })));
    toast.success("Items added to cart");
    nav({ to: "/cart" });
  };

  const cancelOrder = async (o: Order) => {
    if (!confirm(`Cancel ${o.meal_type} for ${formatDate(o.delivery_date)}?`)) return;
    const reason = prompt("Reason (optional):") || null;
    const { error } = await supabase.from("orders").update({
      status: "cancelled", cancel_reason: reason, cancelled_at: new Date().toISOString(),
    }).eq("id", o.id);
    if (error) toast.error(error.message);
    else { toast.success("Order cancelled"); qc.invalidateQueries({ queryKey: ["my-orders", user!.id] }); }
  };

  const editOrder = (o: Order) => {
    // Reuse repeat logic + cancel original
    repeat(o);
    toast.message("Adjust items in cart, place a new order, then cancel the old one from this list.");
  };

  const summaries = useMemo(() => {
    if (!orders) return null;
    const today = todayISO();
    const w = startOfWeekISO();
    const m = startOfMonthISO();
    const week = orders.filter((o) => o.delivery_date >= w);
    const month = orders.filter((o) => o.delivery_date >= m);
    return {
      week: { from: w, to: today, list: week, total: week.reduce((s, o) => s + Number(o.total_amount), 0) },
      month: { from: m, to: today, list: month, total: month.reduce((s, o) => s + Number(o.total_amount), 0) },
    };
  }, [orders]);

  if (loading || !user) return <div className="phone-shell" />;

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="px-5 pt-10 pb-4">
        <h1 className="font-display text-3xl">My orders</h1>
        <p className="text-sm text-muted-foreground">History, billing & one-click reorder</p>
      </header>

      <div className="flex-1 px-5 pb-6 space-y-4">
        <div className="flex gap-2">
          <Link to="/addresses" className="flex-1 rounded-2xl bg-card p-3 shadow-soft text-sm">
            <MapPin className="h-4 w-4 inline mr-1 text-primary" /> Saved addresses
          </Link>
        </div>

        {last && (
          <button onClick={() => repeat(last)} className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-4 text-left text-primary-foreground shadow-soft">
            <Repeat2 className="h-6 w-6 shrink-0" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest opacity-90">Repeat previous order</p>
              <p className="font-semibold capitalize">{last.meal_type} · {last.items.length} items · {inr(Number(last.total_amount))}</p>
            </div>
            <span className="rounded-full bg-card/20 px-3 py-1 text-xs font-semibold backdrop-blur">Reorder</span>
          </button>
        )}

        {summaries && (summaries.week.list.length > 0 || summaries.month.list.length > 0) && (
          <section className="rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Bill summaries</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={summaries.week.list.length === 0}
                onClick={() => downloadSummary(summaries.week.list, { label: "Weekly Bill", from: summaries.week.from, to: summaries.week.to })}
                className="rounded-xl border border-border p-3 text-left disabled:opacity-50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">This week</p>
                <p className="font-display text-lg text-primary">{inr(summaries.week.total)}</p>
                <p className="text-[11px] text-muted-foreground">{summaries.week.list.length} orders · download PDF</p>
              </button>
              <button disabled={summaries.month.list.length === 0}
                onClick={() => downloadSummary(summaries.month.list, { label: "Monthly Bill", from: summaries.month.from, to: summaries.month.to })}
                className="rounded-xl border border-border p-3 text-left disabled:opacity-50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">This month</p>
                <p className="font-display text-lg text-primary">{inr(summaries.month.total)}</p>
                <p className="text-[11px] text-muted-foreground">{summaries.month.list.length} orders · download PDF</p>
              </button>
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders yet</p>
            <Link to="/home" className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-soft">Browse menu</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const Icon = o.meal_type === "lunch" ? Sun : Moon;
              const reviewed = reviewedIds.has(o.id);
              const canReview = o.status === "delivered";
              const editable = canEditOrder(o.delivery_date, o.meal_type, o.status);
              const showOtp = ["confirmed", "preparing", "out_for_delivery"].includes(o.status) && o.delivery_otp && !o.otp_verified_at;
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

                  {showOtp && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                      <KeyRound className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery OTP</p>
                        <p className="font-display text-2xl tracking-[0.3em] text-primary">{o.delivery_otp}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground text-right">Share with delivery partner only</span>
                    </div>
                  )}

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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => repeat(o)} className="rounded-full">
                      <Repeat2 className="h-3.5 w-3.5 mr-1" /> Reorder
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadOrderInvoice(o)} className="rounded-full">
                      <Download className="h-3.5 w-3.5 mr-1" /> Invoice
                    </Button>
                    {editable && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => editOrder(o)} className="rounded-full">Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelOrder(o)} className="rounded-full text-destructive">
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                    {canReview && (
                      <Button size="sm" variant={reviewed ? "outline" : "default"} onClick={() => nav({ to: "/review/$orderId", params: { orderId: o.id } })} className="rounded-full">
                        <Star className="h-3.5 w-3.5 mr-1" /> {reviewed ? "Edit review" : "Rate"}
                      </Button>
                    )}
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
