import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Loader2, Sun, Moon, Settings as SettingsIcon, Package, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ADMIN_EMAIL_LIST } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { inr, formatDate, type MealType } from "@/lib/cutoff";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Family Food Service" }] }),
  component: AdminPage,
});

type Tab = "items" | "orders" | "settings";

interface FoodItem {
  id: string; name: string; description: string | null; price: number;
  meal_type: MealType; is_available: boolean;
}

interface AdminOrder {
  id: string; delivery_date: string; meal_type: MealType;
  items: { name: string; qty: number; price: number }[];
  total_amount: number; status: string; payment_method: string;
  delivery_address: string; phone: string; created_at: string;
}

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("items");

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

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="gradient-hero px-5 pt-10 pb-5">
        <p className="text-xs uppercase tracking-widest text-foreground/60">Family Food Service</p>
        <h1 className="font-display text-3xl">Admin panel</h1>

        <div className="mt-5 flex rounded-full bg-card/70 p-1 backdrop-blur shadow-soft">
          {([
            { k: "items", label: "Items", icon: ChefHat },
            { k: "orders", label: "Orders", icon: Package },
            { k: "settings", label: "Settings", icon: SettingsIcon },
          ] as const).map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${tab === k ? "bg-primary text-primary-foreground shadow-soft" : "text-foreground/70"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-5 pt-5 pb-6">
        {tab === "items" && <ItemsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <BottomNav />
    </div>
  );
}

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
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rice Meal (Bhāt)" className="h-11 rounded-xl" />
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
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
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

function OrdersTab() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as unknown as AdminOrder[];
    },
  });

  type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }
  };

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!orders?.length) return <p className="text-center text-sm text-muted-foreground py-10">No orders yet.</p>;

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="rounded-2xl bg-card p-4 shadow-soft">
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(o.id, s)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${o.status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map(r => [r.key, r.value])) as Record<string, unknown>;
    },
  });

  const cutoffs = (data?.cutoff_times ?? { lunch: "10:00", dinner: "17:00" }) as { lunch: string; dinner: string };
  const pay = (data?.payment_methods ?? { upi: true, card: true, netbanking: true, wallet: true, cod: false }) as Record<string, boolean>;

  const [lunch, setLunch] = useState(cutoffs.lunch);
  const [dinner, setDinner] = useState(cutoffs.dinner);
  const [methods, setMethods] = useState(pay);

  useEffect(() => { setLunch(cutoffs.lunch); setDinner(cutoffs.dinner); setMethods(pay); /* eslint-disable-next-line */ }, [data]);

  const save = async () => {
    const { error: e1 } = await supabase.from("app_settings").upsert({ key: "cutoff_times", value: { lunch, dinner } });
    const { error: e2 } = await supabase.from("app_settings").upsert({ key: "payment_methods", value: methods });
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
        <h2 className="mb-3 font-display text-lg">Payment methods</h2>
        <div className="space-y-2">
          {(Object.keys(methods) as (keyof typeof methods)[]).map((m) => (
            <div key={m} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-sm capitalize">{m === "cod" ? "Cash on delivery" : m === "upi" ? "UPI" : m}</span>
              <Switch checked={methods[m]} onCheckedChange={(v) => setMethods({ ...methods, [m]: v })} />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={save} className="h-12 w-full rounded-xl shadow-soft">Save settings</Button>
    </div>
  );
}
