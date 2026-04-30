import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Plus, Sun, Moon, LogOut, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { BottomNav } from "@/components/BottomNav";
import {
  type MealType, DEFAULT_CUTOFFS, isPastCutoff, formatCutoffMessage, inr, formatDate, nextNDates, todayISO,
} from "@/lib/cutoff";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Today's Menu — Family Food Service" },
      { name: "description", content: "Browse today's lunch & dinner menu and pre-book meals for future dates." },
    ],
  }),
  component: HomePage,
});

interface FoodItem {
  id: string; name: string; description: string | null;
  price: number; meal_type: MealType; image_url: string | null; is_available: boolean;
}

function HomePage() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const { add, items: cartItems, mealType: cartMeal } = useCart();

  const [meal, setMeal] = useState<MealType>("lunch");
  const dates = useMemo(() => nextNDates(7), []);
  const [date, setDate] = useState<string>(dates[0]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  const { data: foods, isLoading } = useQuery({
    queryKey: ["food-items", meal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("meal_type", meal)
        .eq("is_available", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data as FoodItem[];
    },
    enabled: !!user,
  });

  const closed = isPastCutoff(date, meal, DEFAULT_CUTOFFS);

  const handleAdd = (f: FoodItem) => {
    if (closed) {
      toast.error(`${meal === "lunch" ? "Lunch" : "Dinner"} for ${formatDate(date)} is closed`);
      return;
    }
    if (cartItems.length && cartMeal && cartMeal !== meal) {
      toast.error("Your cart already has a different meal. Clear it first.");
      return;
    }
    add({ id: f.id, name: f.name, price: Number(f.price), meal_type: f.meal_type });
    toast.success(`${f.name} added`);
  };

  if (loading || !user) return <div className="phone-shell" />;

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="gradient-hero px-5 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-foreground/60">Namaste 🙏</p>
            <h1 className="font-display text-3xl leading-tight">{user.email?.split("@")[0]}</h1>
          </div>
          <button onClick={() => signOut().then(() => nav({ to: "/login" }))} className="rounded-full bg-card/70 p-2 backdrop-blur" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Meal toggle */}
        <div className="mt-6 flex rounded-full bg-card/70 p-1 backdrop-blur shadow-soft">
          {(["lunch", "dinner"] as const).map((m) => {
            const active = meal === m;
            const Icon = m === "lunch" ? Sun : Moon;
            return (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-primary text-primary-foreground shadow-soft" : "text-foreground/70"
                }`}
              >
                <Icon className="h-4 w-4" />
                {m === "lunch" ? "Lunch" : "Dinner"}
              </button>
            );
          })}
        </div>
      </header>

      {/* Date selector */}
      <div className="px-5 pt-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Choose delivery date
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dates.map((d) => {
            const active = d === date;
            const dt = new Date(d + "T00:00:00");
            const isToday = d === todayISO();
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`flex min-w-[66px] flex-col items-center rounded-2xl border px-3 py-2.5 transition ${
                  active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card text-foreground"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {isToday ? "Today" : dt.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="font-display text-lg leading-tight">{dt.getDate()}</span>
                <span className="text-[10px] opacity-80">{dt.toLocaleDateString("en-IN", { month: "short" })}</span>
              </button>
            );
          })}
        </div>

        {/* Cut-off banner */}
        <div className={`mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
          closed ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
        }`}>
          {closed ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
          <span className="font-medium">
            {closed
              ? `${meal === "lunch" ? "Lunch" : "Dinner"} closed for ${formatDate(date)}`
              : `${formatCutoffMessage(meal)} · ${formatDate(date)}`}
          </span>
        </div>
      </div>

      {/* Food list */}
      <section className="flex-1 px-5 pt-5 pb-4">
        <h2 className="mb-3 font-display text-xl">Available {meal === "lunch" ? "lunch thalis" : "dinner meals"}</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : !foods || foods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No items available right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl gradient-warm text-2xl">
                  {f.meal_type === "lunch" ? "🍛" : "🫓"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{f.name}</h3>
                  {f.description && <p className="line-clamp-2 text-xs text-muted-foreground">{f.description}</p>}
                  <p className="mt-1 font-display text-lg text-primary">{inr(Number(f.price))}</p>
                </div>
                <Button size="icon" disabled={closed} onClick={() => handleAdd(f)} className="h-10 w-10 rounded-full shadow-soft">
                  <Plus className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Link to="/cart" className="mt-6 block text-center text-xs text-primary">View your cart →</Link>
      </section>

      <BottomNav />
    </div>
  );
}
