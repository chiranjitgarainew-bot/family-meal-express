import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, MapPin, Phone, CreditCard, Loader2, ShoppingBag, CheckCircle2, Navigation, Wallet } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type MealType, DEFAULT_CUTOFFS, isPastCutoff, formatCutoffMessage, inr, formatDate, nextNDates, todayISO,
} from "@/lib/cutoff";
import { getCurrentPosition, staticMapUrl, osmLink, type GeoPoint } from "@/lib/location";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — Family Food Service" }] }),
  component: CartPage,
});

const checkoutSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
  address: z.string().trim().min(10, "Address must be at least 10 characters").max(500),
  notes: z.string().max(300).optional(),
});

type PaymentMethod = "cod" | "upi" | "card" | "netbanking" | "wallet";

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; sub: string; available: boolean }[] = [
  { id: "cod", label: "Cash on Delivery", sub: "Pay when food arrives", available: true },
  { id: "upi", label: "UPI", sub: "Coming soon", available: false },
  { id: "card", label: "Debit / Credit Card", sub: "Coming soon", available: false },
  { id: "netbanking", label: "Net Banking", sub: "Coming soon", available: false },
  { id: "wallet", label: "Wallet", sub: "Coming soon", available: false },
];

function CartPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { items, setQty, remove, total, clear, mealType } = useCart();

  const [date, setDate] = useState<string>(todayISO());
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<PaymentMethod>("cod");
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("phone, address").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.phone) setPhone(data.phone);
      if (data?.address) setAddress(data.address);
    });
  }, [user]);

  const meal: MealType = mealType ?? "lunch";
  const closed = isPastCutoff(date, meal, DEFAULT_CUTOFFS);
  const dates = nextNDates(7);

  const captureLocation = async () => {
    setLocBusy(true);
    try {
      const p = await getCurrentPosition();
      setLoc(p);
      toast.success("Live location captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get location");
    } finally {
      setLocBusy(false);
    }
  };

  const placeOrder = async () => {
    const parsed = checkoutSchema.safeParse({ phone, address, notes });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!items.length || !mealType) { toast.error("Cart is empty"); return; }
    if (closed) { toast.error("This meal slot has closed for the selected date"); return; }
    if (pay !== "cod") { toast.error("Selected payment method is coming soon. Please use Cash on Delivery."); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("orders").insert({
        user_id: user!.id,
        delivery_date: date,
        meal_type: mealType,
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total_amount: total,
        status: "confirmed",
        payment_method: "cod",
        payment_status: "pending", // COD: paid on delivery
        delivery_address: parsed.data.address,
        phone: parsed.data.phone,
        notes: parsed.data.notes || null,
        delivery_lat: loc?.lat ?? null,
        delivery_lng: loc?.lng ?? null,
        location_accuracy: loc?.accuracy ?? null,
      });
      if (error) throw error;
      await supabase.from("profiles").update({ phone: parsed.data.phone, address: parsed.data.address }).eq("id", user!.id);
      setSuccess(true);
      clear();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return <div className="phone-shell" />;

  if (success) {
    return (
      <div className="phone-shell flex min-h-[100dvh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="mt-6 font-display text-3xl">Order placed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your {meal} for {formatDate(date)} is confirmed. Pay {inr(total)} cash on delivery.
          </p>
          <div className="mt-8 flex w-full gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setSuccess(false); nav({ to: "/orders" }); }}>
              View orders
            </Button>
            <Button className="flex-1 h-12 rounded-xl shadow-soft" onClick={() => { setSuccess(false); nav({ to: "/home" }); }}>
              Order more
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="px-5 pt-10 pb-4">
        <Link to="/home" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-2 font-display text-3xl">Your cart</h1>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Your cart is empty</p>
          <Button onClick={() => nav({ to: "/home" })} className="mt-6 rounded-xl">Browse menu</Button>
        </div>
      ) : (
        <div className="flex-1 px-5 pb-6">
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl gradient-warm text-2xl">
                  {i.meal_type === "lunch" ? "🍛" : "🫓"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-sm">{i.name}</h3>
                  <p className="text-primary font-display">{inr(i.price)}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-muted px-1 py-1">
                  <button onClick={() => setQty(i.id, i.qty - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-card"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="min-w-5 text-center text-sm font-semibold">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-card"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <button onClick={() => remove(i.id)} className="text-destructive p-1" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          {/* Date picker */}
          <div className="mt-6">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Delivery date</div>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dates.map((d) => {
                const active = d === date;
                const dt = new Date(d + "T00:00:00");
                const isToday = d === todayISO();
                return (
                  <button key={d} onClick={() => setDate(d)} className={`flex min-w-[66px] flex-col items-center rounded-2xl border px-3 py-2.5 transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{isToday ? "Today" : dt.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                    <span className="font-display text-lg">{dt.getDate()}</span>
                    <span className="text-[10px] opacity-80">{dt.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 text-xs ${closed ? "text-destructive" : "text-muted-foreground"}`}>
              {closed ? `${meal} closed for ${formatDate(date)}. Pick another date.` : formatCutoffMessage(meal)}
            </p>
          </div>

          {/* Address */}
          <div className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
              <Input id="phone" inputMode="numeric" maxLength={10} placeholder="98xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address" className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Delivery address</Label>
              <Textarea id="address" placeholder="House no, street, area, landmark, city" value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" rows={3} />
            </div>

            {/* Live location */}
            <div className="rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Live location</span>
                </div>
                <Button type="button" variant={loc ? "outline" : "default"} size="sm" onClick={captureLocation} disabled={locBusy} className="rounded-full">
                  {locBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : loc ? "Update" : "Share"}
                </Button>
              </div>
              {loc ? (
                <div className="mt-2">
                  <img
                    src={staticMapUrl(loc, 600, 240)}
                    alt="Map preview of your delivery point"
                    className="w-full rounded-xl border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · ±{Math.round(loc.accuracy)}m</span>
                    <a href={osmLink(loc)} target="_blank" rel="noreferrer" className="text-primary">Open map ↗</a>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">Share your GPS location so we deliver to the exact spot.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" placeholder="Less spicy, extra roti..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12 rounded-xl" />
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-6">
            <Label className="flex items-center gap-1.5 mb-2"><CreditCard className="h-3.5 w-3.5" /> Payment method</Label>
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map((m) => {
                const active = pay === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => m.available && setPay(m.id)}
                    disabled={!m.available}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active ? "border-primary bg-primary/10" : "border-border bg-card"
                    } ${m.available ? "" : "opacity-60 cursor-not-allowed"}`}
                  >
                    <div className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.id === "cod" ? <Wallet className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.sub}</p>
                    </div>
                    {!m.available && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
                        Soon
                      </span>
                    )}
                    {active && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total (pay on delivery)</span>
              <span className="font-display text-2xl text-primary">{inr(total)}</span>
            </div>
            <Button onClick={placeOrder} disabled={submitting || closed} className="mt-3 h-12 w-full rounded-xl text-base font-semibold shadow-soft">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Place order · ${inr(total)} COD`}
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
