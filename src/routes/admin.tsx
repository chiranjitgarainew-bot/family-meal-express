import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit3, Loader2, Sun, Moon, Settings as SettingsIcon, Package, ChefHat,
  LayoutDashboard, Users, Truck, History, KeyRound, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ADMIN_EMAIL_LIST } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { inr, formatDate, type MealType, todayISO } from "@/lib/cutoff";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Family Food Service" }] }),
  component: AdminPage,
});

type Tab = "dashboard" | "orders" | "kitchen" | "items" | "delivery" | "customers" | "settings";

interface FoodItem {
  id: string; name: string; description: string | null; price: number;
  meal_type: MealType; is_available: boolean;
}

interface AdminOrder {
  id: string; user_id: string; delivery_date: string; meal_type: MealType;
  items: { name: string; qty: number; price: number }[];
  total_amount: number; status: string; payment_method: string; payment_status: string;
  delivery_address: string; phone: string; created_at: string;
  delivery_otp: string | null; otp_verified_at: string | null;
  delivery_boy_id: string | null;
  cancel_reason: string | null;
  admin_note: string | null;
}

interface DeliveryBoy {
  id: string; user_id: string; full_name: string; phone: string; is_active: boolean;
}

interface Profile {
  id: string; email: string | null; full_name: string | null; phone: string | null;
  priority: "regular" | "vip" | "subscriber";
}

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  if (loading || !user) return <div className="phone-shell" />;

  if (!isAdmin) {
    return (
      <div className="phone-shell flex min-h-[100dvh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <SettingsIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-display text-2xl">Admin access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted. Sign in with one of the admin accounts:
          </p>
          <code className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">{ADMIN_EMAIL_LIST.join(", ")}</code>
          <Link to="/home" className="mt-6 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground shadow-soft">Back to menu</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const tabs: { k: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { k: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { k: "orders", label: "Orders", icon: Package },
    { k: "kitchen", label: "Kitchen", icon: ChefHat },
    { k: "items", label: "Items", icon: ChefHat },
    { k: "delivery", label: "Delivery", icon: Truck },
    { k: "customers", label: "Customers", icon: Users },
    { k: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="gradient-hero px-5 pt-10 pb-5">
        <p className="text-xs uppercase tracking-widest text-foreground/60">Family Food Service</p>
        <h1 className="font-display text-3xl">Admin panel</h1>

        <div className="mt-5 -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(({ k, label, icon: Icon }) => (
            <button
              key={k} onClick={() => setTab(k)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                tab === k ? "bg-primary text-primary-foreground shadow-soft" : "bg-card/70 text-foreground/70 backdrop-blur"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-5 pt-5 pb-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "kitchen" && <KitchenTab />}
        {tab === "items" && <ItemsTab />}
        {tab === "delivery" && <DeliveryTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <BottomNav />
    </div>
  );
}

/* ======================== DASHBOARD ======================== */
function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const [ordersRes, profilesRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, priority"),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (profilesRes.error) throw profilesRes.error;
      const orders = ordersRes.data as unknown as AdminOrder[];
      const profiles = profilesRes.data as { id: string; priority: string }[];

      const todayOrders = orders.filter((o) => o.delivery_date === today);
      const todayRevenue = todayOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total_amount), 0);
      const pending = orders.filter((o) => o.status === "pending").length;
      const pendingDeliveries = orders.filter((o) => ["confirmed", "preparing", "out_for_delivery"].includes(o.status)).length;
      const cancelled = orders.filter((o) => o.status === "cancelled").length;
      const codPending = orders.filter((o) => o.payment_method === "cod" && o.payment_status !== "paid" && o.status !== "cancelled");
      const codPendingTotal = codPending.reduce((s, o) => s + Number(o.total_amount), 0);
      const subs = profiles.filter((p) => p.priority === "subscriber").length;

      return {
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        todayRevenue,
        activeUsers: profiles.length,
        pending,
        pendingDeliveries,
        cancelled,
        subs,
        codPendingCount: codPending.length,
        codPendingTotal,
      };
    },
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  const cards = [
    { label: "Total orders", value: data.totalOrders, color: "text-primary" },
    { label: "Today revenue", value: inr(data.todayRevenue), color: "text-success" },
    { label: "Today orders", value: data.todayOrders, color: "text-primary" },
    { label: "Active users", value: data.activeUsers, color: "text-foreground" },
    { label: "Pending review", value: data.pending, color: "text-warning-foreground" },
    { label: "In-progress deliveries", value: data.pendingDeliveries, color: "text-primary" },
    { label: "Subscribers", value: data.subs, color: "text-success" },
    { label: "Cancelled", value: data.cancelled, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-card p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={`mt-1 font-display text-2xl ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning-foreground" />
          <h3 className="font-display text-lg">COD pending payments</h3>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{data.codPendingCount} orders awaiting cash</span>
          <span className="font-display text-2xl text-warning-foreground">{inr(data.codPendingTotal)}</span>
        </div>
      </div>
    </div>
  );
}

/* ======================== ORDERS (confirm/reject/OTP/assign) ======================== */
function OrdersTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "active" | "all">("pending");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as AdminOrder[];
    },
  });

  const { data: boys } = useQuery({
    queryKey: ["delivery-boys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_boys").select("*").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data as DeliveryBoy[];
    },
  });

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (filter === "pending") return orders.filter((o) => o.status === "pending");
    if (filter === "active") return orders.filter((o) => ["confirmed", "preparing", "out_for_delivery"].includes(o.status));
    return orders;
  }, [orders, filter]);

  const update = async (id: string, patch: Partial<AdminOrder>) => {
    const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }
  };

  const verifyOtp = async (o: AdminOrder, entered: string) => {
    if (!entered || entered !== o.delivery_otp) {
      toast.error("OTP does not match");
      return;
    }
    await update(o.id, {
      status: "delivered" as AdminOrder["status"],
      otp_verified_at: new Date().toISOString(),
      payment_status: o.payment_method === "cod" ? "paid" : o.payment_status,
    } as Partial<AdminOrder>);
  };

  if (isLoading) return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>;

  return (
    <div className="space-y-3">
      <div className="flex rounded-full bg-muted p-1">
        {(["pending", "active", "all"] as const).map((f) => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <p className="text-center text-sm text-muted-foreground py-10">No orders in this view.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => <OrderCard key={o.id} o={o} boys={boys ?? []} onUpdate={update} onVerifyOtp={verifyOtp} />)}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ o, boys, onUpdate, onVerifyOtp }: {
  o: AdminOrder;
  boys: DeliveryBoy[];
  onUpdate: (id: string, patch: Partial<AdminOrder>) => Promise<void>;
  onVerifyOtp: (o: AdminOrder, entered: string) => Promise<void>;
}) {
  const [otpInput, setOtpInput] = useState("");
  const [showOtp, setShowOtp] = useState(false);

  return (
    <li className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold capitalize text-sm">{o.meal_type} · {formatDate(o.delivery_date)}</p>
          <p className="text-xs text-muted-foreground">{o.phone} · {o.payment_method.toUpperCase()}</p>
        </div>
        <span className="font-display text-primary">{inr(Number(o.total_amount))}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{o.delivery_address}</p>
      <ul className="mt-2 text-xs">
        {o.items.map((it, i) => <li key={i}>• {it.name} × {it.qty}</li>)}
      </ul>

      {o.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onUpdate(o.id, { status: "confirmed" as AdminOrder["status"] } as Partial<AdminOrder>)} className="flex-1 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={async () => {
              const reason = prompt("Reject reason?") || "Rejected by admin";
              await onUpdate(o.id, { status: "cancelled" as AdminOrder["status"], cancel_reason: reason } as Partial<AdminOrder>);
            }}
            className="flex-1 rounded-full text-destructive"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
        </div>
      )}

      {["confirmed", "preparing", "out_for_delivery"].includes(o.status) && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["preparing", "out_for_delivery"] as const).map((s) => (
              <button key={s} onClick={() => onUpdate(o.id, { status: s as AdminOrder["status"] } as Partial<AdminOrder>)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${o.status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Assign delivery boy</Label>
              <select
                value={o.delivery_boy_id ?? ""}
                onChange={(e) => onUpdate(o.id, { delivery_boy_id: e.target.value || null } as Partial<AdminOrder>)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm"
              >
                <option value="">— Unassigned —</option>
                {boys.map((b) => <option key={b.id} value={b.id}>{b.full_name} · {b.phone}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" /> Delivery OTP</span>
                <button onClick={() => setShowOtp((v) => !v)} className="text-[10px] text-primary">{showOtp ? "Hide" : "Show"}</button>
              </div>
              {showOtp && <p className="mt-1 font-display text-xl tracking-[0.2em] text-primary">{o.delivery_otp}</p>}
              <div className="mt-2 flex gap-2">
                <Input value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))} maxLength={4} placeholder="Enter OTP from customer"
                  className="h-9 rounded-lg flex-1" />
                <Button size="sm" onClick={() => onVerifyOtp(o, otpInput)} className="rounded-lg">
                  Verify & Deliver
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {o.status === "delivered" && (
        <p className="mt-3 text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Delivered{o.otp_verified_at ? ` · OTP verified ${new Date(o.otp_verified_at).toLocaleString("en-IN")}` : ""}</p>
      )}
      {o.status === "cancelled" && (
        <p className="mt-3 text-xs text-destructive">Cancelled{o.cancel_reason ? ` · ${o.cancel_reason}` : ""}</p>
      )}
    </li>
  );
}

/* ======================== KITCHEN PANEL ======================== */
function KitchenTab() {
  const [date, setDate] = useState(todayISO());

  const { data, isLoading } = useQuery({
    queryKey: ["kitchen", date],
    queryFn: async () => {
      const { data: orders, error } = await supabase.from("orders").select("*")
        .eq("delivery_date", date)
        .neq("status", "cancelled");
      if (error) throw error;
      const all = (orders ?? []) as unknown as AdminOrder[];

      const byMeal = { lunch: 0, dinner: 0 };
      const byStatus: Record<string, number> = { pending: 0, confirmed: 0, preparing: 0, out_for_delivery: 0, delivered: 0 };
      const itemCounts = new Map<string, number>();
      // keyword counts
      const keywords = ["rice", "roti", "fish", "egg", "chicken", "meat", "mutton", "dal", "veg", "paneer"];
      const keywordCounts: Record<string, number> = Object.fromEntries(keywords.map((k) => [k, 0]));

      for (const o of all) {
        byMeal[o.meal_type] += 1;
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
        for (const it of o.items) {
          itemCounts.set(it.name, (itemCounts.get(it.name) ?? 0) + it.qty);
          const lower = it.name.toLowerCase();
          for (const k of keywords) if (lower.includes(k)) keywordCounts[k] += it.qty;
        }
      }

      // group orders by customer
      const userIds = Array.from(new Set(all.map((o) => o.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email, phone, priority").in("id", userIds);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
      const byCustomer = new Map<string, { profile: Profile | null; orders: AdminOrder[]; total: number }>();
      for (const o of all) {
        const cur = byCustomer.get(o.user_id) ?? { profile: profMap.get(o.user_id) ?? null, orders: [], total: 0 };
        cur.orders.push(o);
        cur.total += Number(o.total_amount);
        byCustomer.set(o.user_id, cur);
      }

      return {
        total: all.length,
        byMeal, byStatus,
        items: Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]),
        keywords: Object.entries(keywordCounts).filter(([, v]) => v > 0),
        customers: Array.from(byCustomer.entries()).map(([uid, v]) => ({ uid, ...v })),
      };
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Production date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl mt-1" />
      </div>

      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <h3 className="font-display text-lg">Daily production summary</h3>
            <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Total" value={data.total} />
              <Stat label="Lunch" value={data.byMeal.lunch} />
              <Stat label="Dinner" value={data.byMeal.dinner} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              {Object.entries(data.byStatus).map(([s, n]) => (
                <Stat key={s} label={s.replace(/_/g, " ")} value={n} small />
              ))}
            </div>
          </div>

          {data.keywords.length > 0 && (
            <div className="rounded-2xl bg-card p-4 shadow-soft">
              <h3 className="font-display text-lg">Ingredients to prepare</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {data.keywords.map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted px-3 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                    <p className="font-display text-xl text-primary">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.items.length > 0 && (
            <div className="rounded-2xl bg-card p-4 shadow-soft">
              <h3 className="font-display text-lg">Item-wise count</h3>
              <ul className="mt-2 divide-y divide-border">
                {data.items.map(([name, qty]) => (
                  <li key={name} className="flex justify-between py-2 text-sm">
                    <span>{name}</span>
                    <span className="font-semibold">× {qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.customers.length > 0 && (
            <div className="rounded-2xl bg-card p-4 shadow-soft">
              <h3 className="font-display text-lg">Per-customer plates</h3>
              <ul className="mt-2 space-y-2">
                {data.customers.map((c) => (
                  <li key={c.uid} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{c.profile?.full_name || c.profile?.email || "Customer"}</p>
                        <p className="text-[11px] text-muted-foreground">{c.profile?.phone}</p>
                      </div>
                      <span className="font-display text-primary">{inr(c.total)}</span>
                    </div>
                    <ul className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                      {c.orders.flatMap((o) => o.items.map((it, i) => (
                        <li key={`${o.id}-${i}`}>• {it.name} × {it.qty} <span className="opacity-70">({o.meal_type})</span></li>
                      )))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display ${small ? "text-lg" : "text-2xl"} text-primary`}>{value}</p>
    </div>
  );
}

/* ======================== ITEMS ======================== */
function ItemsTab() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("food_items").select("*").order("meal_type").order("price");
      if (error) throw error;
      return data as FoodItem[];
    },
  });

  const empty = { name: "", description: "", price: 0, meal_type: "lunch" as MealType, is_available: true };
  const [form, setForm] = useState<typeof empty & { id?: string }>(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || form.price < 0) { toast.error("Name and valid price required"); return; }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("food_items").update({
          name: form.name, description: form.description, price: form.price,
          meal_type: form.meal_type, is_available: form.is_available,
        }).eq("id", form.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        const { error } = await supabase.from("food_items").insert({
          name: form.name, description: form.description, price: form.price,
          meal_type: form.meal_type, is_available: form.is_available,
        });
        if (error) throw error;
        toast.success("Item added");
      }
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin-items"] });
      qc.invalidateQueries({ queryKey: ["food-items"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("food_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-items"] }); }
  };

  const toggle = async (it: FoodItem) => {
    const { error } = await supabase.from("food_items").update({ is_available: !it.is_available }).eq("id", it.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-items"] });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg">{form.id ? "Edit item" : "Add new item"}</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rice Meal" className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's in this meal" className="rounded-xl" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Price (₹)</Label>
              <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="h-11 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Meal type</Label>
              <div className="flex h-11 rounded-xl bg-muted p-1">
                {(["lunch", "dinner"] as const).map((m) => (
                  <button key={m} onClick={() => setForm({ ...form, meal_type: m })} className={`flex-1 rounded-lg text-sm font-medium ${form.meal_type === m ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                    {m === "lunch" ? "Lunch" : "Dinner"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
            <Label className="text-sm">Available for ordering</Label>
            <Switch checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
          </div>
          <div className="flex gap-2">
            {form.id && <Button variant="outline" onClick={() => setForm(empty)} className="rounded-xl">Cancel</Button>}
            <Button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl shadow-soft">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {form.id ? "Update" : "Add item"}</>}
            </Button>
          </div>
        </div>
      </div>

      <h3 className="font-display text-lg">All items</h3>
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <ul className="space-y-2">
          {items?.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-warm">
                {it.meal_type === "lunch" ? <Sun className="h-5 w-5 text-primary-foreground" /> : <Moon className="h-5 w-5 text-primary-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-sm">{it.name}</span>
                  {!it.is_available && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">off</span>}
                </div>
                <p className="text-xs text-primary font-display">{inr(Number(it.price))}</p>
              </div>
              <Switch checked={it.is_available} onCheckedChange={() => toggle(it)} />
              <button onClick={() => setForm({ id: it.id, name: it.name, description: it.description ?? "", price: Number(it.price), meal_type: it.meal_type, is_available: it.is_available })} className="text-muted-foreground p-1.5"><Edit3 className="h-4 w-4" /></button>
              <button onClick={() => remove(it.id)} className="text-destructive p-1.5"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ======================== DELIVERY BOYS ======================== */
function DeliveryTab() {
  const qc = useQueryClient();
  const { data: boys } = useQuery({
    queryKey: ["all-delivery-boys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_boys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeliveryBoy[];
    },
  });

  // performance: deliveries by boy
  const { data: perf } = useQuery({
    queryKey: ["delivery-performance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("delivery_boy_id, status, total_amount")
        .eq("status", "delivered")
        .not("delivery_boy_id", "is", null);
      if (error) throw error;
      const m = new Map<string, { count: number; total: number }>();
      for (const o of (data ?? []) as { delivery_boy_id: string; total_amount: number }[]) {
        const cur = m.get(o.delivery_boy_id) ?? { count: 0, total: 0 };
        cur.count += 1;
        cur.total += Number(o.total_amount);
        m.set(o.delivery_boy_id, cur);
      }
      return m;
    },
  });

  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.email || !form.password || !form.full_name || !form.phone) {
      toast.error("Fill all fields"); return;
    }
    setBusy(true);
    try {
      // Create auth user via signUp (admin email allowlist gives admin role; new user is regular)
      const { data: signed, error: signErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name } },
      });
      if (signErr) throw signErr;
      const newId = signed.user?.id;
      if (!newId) throw new Error("Could not create account");

      // Re-sign back in as admin: user is now switched. We need to insert delivery_boys row with the new id.
      // Insert is admin-only via RLS, so we must be admin. signUp swaps session — sign back in.
      // A safer flow: ask admin to re-login. We simply insert before session swap is complete by using the same user id.
      const { error: insErr } = await supabase.from("delivery_boys").insert({
        user_id: newId, full_name: form.full_name, phone: form.phone, is_active: true,
      });
      // If insert fails because session was swapped to the new (non-admin) user, instruct admin.
      if (insErr) {
        toast.warning("Account created but admin session swapped. Please sign back in as admin and add the delivery boy row from the database, or simply re-add now.");
        throw insErr;
      }

      toast.success("Delivery boy added. You may need to sign back in as admin.");
      setForm({ email: "", password: "", full_name: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["all-delivery-boys"] });
      qc.invalidateQueries({ queryKey: ["delivery-boys"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add delivery boy");
    } finally { setBusy(false); }
  };

  const toggle = async (b: DeliveryBoy) => {
    const { error } = await supabase.from("delivery_boys").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["all-delivery-boys"] });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg">Add delivery boy</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">Note: creating an account here will switch your session. Sign back in as admin afterwards.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs">Login email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Temp password</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 rounded-xl" />
          </div>
        </div>
        <Button onClick={create} disabled={busy} className="mt-3 w-full h-11 rounded-xl shadow-soft">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add delivery boy"}
        </Button>
      </div>

      <h3 className="font-display text-lg">Delivery team & performance</h3>
      <ul className="space-y-2">
        {(boys ?? []).map((b) => {
          const p = perf?.get(b.id);
          return (
            <li key={b.id} className="rounded-2xl bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{b.full_name}</p>
                  <p className="text-xs text-muted-foreground">{b.phone}</p>
                </div>
                <Switch checked={b.is_active} onCheckedChange={() => toggle(b)} />
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <span className="rounded-full bg-muted px-2 py-1">Deliveries: <strong className="text-foreground">{p?.count ?? 0}</strong></span>
                <span className="rounded-full bg-muted px-2 py-1">Revenue: <strong className="text-foreground">{inr(p?.total ?? 0)}</strong></span>
              </div>
            </li>
          );
        })}
        {!boys?.length && <p className="text-center text-sm text-muted-foreground py-6">No delivery staff yet.</p>}
      </ul>
    </div>
  );
}

/* ======================== CUSTOMERS ======================== */
function CustomersTab() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: customerOrders } = useQuery({
    queryKey: ["customer-orders-grouped"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("user_id, total_amount, status, payment_method, payment_status").limit(1000);
      if (error) throw error;
      const m = new Map<string, { orders: number; spent: number; codDue: number }>();
      for (const o of (data ?? []) as { user_id: string; total_amount: number; status: string; payment_method: string; payment_status: string }[]) {
        const cur = m.get(o.user_id) ?? { orders: 0, spent: 0, codDue: 0 };
        cur.orders += 1;
        if (o.status !== "cancelled") cur.spent += Number(o.total_amount);
        if (o.payment_method === "cod" && o.payment_status !== "paid" && o.status !== "cancelled") cur.codDue += Number(o.total_amount);
        m.set(o.user_id, cur);
      }
      return m;
    },
  });

  const [openId, setOpenId] = useState<string | null>(null);

  const setPriority = async (id: string, priority: Profile["priority"]) => {
    const { error } = await supabase.from("profiles").update({ priority }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Priority updated"); qc.invalidateQueries({ queryKey: ["all-profiles"] }); }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg">All customers</h3>
      {!profiles?.length ? (
        <p className="text-center text-sm text-muted-foreground py-6">No customers yet.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => {
            const stats = customerOrders?.get(p.id);
            const isOpen = openId === p.id;
            return (
              <li key={p.id} className="rounded-2xl bg-card p-3 shadow-soft">
                <button onClick={() => setOpenId(isOpen ? null : p.id)} className="flex w-full items-center justify-between text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-sm">{p.full_name || p.email}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                        p.priority === "vip" ? "bg-warning/20 text-warning-foreground"
                        : p.priority === "subscriber" ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                      }`}>{p.priority}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{p.phone || p.email}</p>
                  </div>
                  <div className="text-right text-[11px]">
                    <p className="text-muted-foreground">{stats?.orders ?? 0} orders</p>
                    <p className="font-semibold">{inr(stats?.spent ?? 0)}</p>
                    {stats?.codDue ? <p className="text-warning-foreground">COD due: {inr(stats.codDue)}</p> : null}
                  </div>
                </button>
                {isOpen && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {(["regular", "vip", "subscriber"] as const).map((tag) => (
                        <button key={tag} onClick={() => setPriority(p.id, tag)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${p.priority === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                    <CustomerHistory userId={p.id} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CustomerHistory({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-history", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as unknown as AdminOrder[];
    },
  });
  if (isLoading) return <p className="mt-3 text-xs text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="mt-3 text-xs text-muted-foreground">No orders.</p>;
  return (
    <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
      {data.map((o) => (
        <li key={o.id} className="rounded-lg bg-muted/40 px-2 py-1.5">
          <div className="flex justify-between">
            <span className="capitalize">{o.meal_type} · {formatDate(o.delivery_date)}</span>
            <span className="font-semibold">{inr(Number(o.total_amount))}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {o.items.map((it) => `${it.name}×${it.qty}`).join(", ")} · {o.status}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ======================== SETTINGS ======================== */
function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, unknown>;
    },
  });

  const cutoffs = (data?.cutoff_times ?? { lunch: "10:00", dinner: "17:00" }) as { lunch: string; dinner: string };
  const support = (data?.support_contact ?? { phone: "", whatsapp: "" }) as { phone: string; whatsapp: string };

  const [lunch, setLunch] = useState(cutoffs.lunch);
  const [dinner, setDinner] = useState(cutoffs.dinner);
  const [phone, setPhone] = useState(support.phone);
  const [whatsapp, setWhatsapp] = useState(support.whatsapp);

  useEffect(() => {
    setLunch(cutoffs.lunch); setDinner(cutoffs.dinner);
    setPhone(support.phone); setWhatsapp(support.whatsapp);
    /* eslint-disable-next-line */
  }, [data]);

  const save = async () => {
    const { error: e1 } = await supabase.from("app_settings").upsert({ key: "cutoff_times", value: { lunch, dinner } });
    const { error: e2 } = await supabase.from("app_settings").upsert({ key: "support_contact", value: { phone, whatsapp } });
    if (e1 || e2) toast.error((e1 || e2)!.message);
    else { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["app-settings"] }); }
  };

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg">Order cut-off times</h2>
        <p className="mb-3 text-xs text-muted-foreground">Same-day orders close at these times. Future-date orders are always open.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lunch cut-off</Label>
            <Input type="time" value={lunch} onChange={(e) => setLunch(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs">Dinner cut-off</Label>
            <Input type="time" value={dinner} onChange={(e) => setDinner(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg">Emergency contact for customers</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Support phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9xxxxxxxxx" className="h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp number</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="91xxxxxxxxxx" className="h-11 rounded-xl" />
          </div>
        </div>
      </div>

      <Button onClick={save} className="h-12 w-full rounded-xl shadow-soft">Save settings</Button>
    </div>
  );
}
