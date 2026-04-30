import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/cutoff";

export const Route = createFileRoute("/review/$orderId")({
  head: () => ({ meta: [{ title: "Rate your order — Family Food Service" }] }),
  component: ReviewPage,
});

const schema = z.object({
  food_rating: z.number().min(1).max(5),
  delivery_rating: z.number().min(1).max(5),
  food_comment: z.string().max(500).optional(),
  delivery_comment: z.string().max(500).optional(),
});

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-1" aria-label={`${n} star`}>
          <Star className={`h-7 w-7 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { orderId } = Route.useParams();

  const [order, setOrder] = useState<{ delivery_date: string; meal_type: string; status: string } | null>(null);
  const [foodR, setFoodR] = useState(5);
  const [delR, setDelR] = useState(5);
  const [foodC, setFoodC] = useState("");
  const [delC, setDelC] = useState("");
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login", replace: true }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: o } = await supabase.from("orders").select("delivery_date, meal_type, status").eq("id", orderId).maybeSingle();
      if (o) setOrder(o);
      const { data: r } = await supabase.from("order_reviews").select("*").eq("order_id", orderId).maybeSingle();
      if (r) {
        setExisting(true);
        setFoodR(r.food_rating); setDelR(r.delivery_rating);
        setFoodC(r.food_comment ?? ""); setDelC(r.delivery_comment ?? "");
      }
    })();
  }, [user, orderId]);

  const submit = async () => {
    const parsed = schema.safeParse({ food_rating: foodR, delivery_rating: delR, food_comment: foodC, delivery_comment: delC });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      if (existing) {
        const { error } = await supabase.from("order_reviews").update({
          food_rating: foodR, delivery_rating: delR,
          food_comment: foodC || null, delivery_comment: delC || null,
        }).eq("order_id", orderId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("order_reviews").insert({
          order_id: orderId, user_id: user!.id,
          food_rating: foodR, delivery_rating: delR,
          food_comment: foodC || null, delivery_comment: delC || null,
        });
        if (error) throw error;
      }
      toast.success("Thanks for your feedback!");
      nav({ to: "/orders" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return <div className="phone-shell" />;

  const canReview = order?.status === "delivered";

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="px-5 pt-10 pb-4">
        <Link to="/orders" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-2 font-display text-3xl">Rate your order</h1>
        {order && <p className="text-sm text-muted-foreground capitalize">{order.meal_type} · {formatDate(order.delivery_date)}</p>}
      </header>

      <div className="flex-1 px-5 pb-6 space-y-5">
        {!canReview ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
            You can rate this order once it has been delivered.
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-card p-4 shadow-soft">
              <h2 className="font-semibold">Food quality</h2>
              <Stars value={foodR} onChange={setFoodR} />
              <Textarea placeholder="Taste, freshness, portion..." value={foodC} onChange={(e) => setFoodC(e.target.value)} className="mt-3 rounded-xl" rows={3} />
            </section>

            <section className="rounded-2xl bg-card p-4 shadow-soft">
              <h2 className="font-semibold">Delivery service</h2>
              <Stars value={delR} onChange={setDelR} />
              <Textarea placeholder="Timing, packaging, courtesy..." value={delC} onChange={(e) => setDelC(e.target.value)} className="mt-3 rounded-xl" rows={3} />
            </section>

            <Button onClick={submit} disabled={busy} className="h-12 w-full rounded-xl text-base font-semibold shadow-soft">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : existing ? "Update review" : "Submit review"}
            </Button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
