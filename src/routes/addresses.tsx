import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home as HomeIcon, Briefcase, Building2, MapPin, Plus, Trash2, Star, Navigation, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentPosition, type GeoPoint } from "@/lib/location";

export const Route = createFileRoute("/addresses")({
  head: () => ({ meta: [{ title: "Saved addresses — Family Food Service" }] }),
  component: AddressesPage,
});

const addrSchema = z.object({
  label: z.string().trim().min(1).max(40),
  full_address: z.string().trim().min(10, "Address must be at least 10 characters").max(500),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
});

interface AddressRow {
  id: string;
  label: string;
  full_address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  location_accuracy: number | null;
  is_default: boolean;
}

const LABEL_PRESETS = [
  { value: "Home", icon: HomeIcon },
  { value: "Office", icon: Briefcase },
  { value: "Hostel", icon: Building2 },
  { value: "PG", icon: Building2 },
  { value: "Other", icon: MapPin },
];

function iconFor(label: string) {
  return LABEL_PRESETS.find((p) => p.value.toLowerCase() === label.toLowerCase())?.icon ?? MapPin;
}

function AddressesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses").select("*").eq("user_id", user!.id)
        .order("is_default", { ascending: false }).order("created_at");
      if (error) throw error;
      return data as AddressRow[];
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({ id: "", label: "Home", full_address: "", phone: "" });
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const reset = () => { setForm({ id: "", label: "Home", full_address: "", phone: "" }); setLoc(null); setShowForm(false); };

  const captureLoc = async () => {
    try {
      const p = await getCurrentPosition();
      setLoc(p);
      toast.success("Location captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get location");
    }
  };

  const save = async () => {
    const parsed = addrSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const payload = {
        user_id: user!.id,
        label: parsed.data.label,
        full_address: parsed.data.full_address,
        phone: parsed.data.phone,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        location_accuracy: loc?.accuracy ?? null,
      };
      if (form.id) {
        const { error } = await supabase.from("user_addresses").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Address updated");
      } else {
        // first address auto-default
        const isFirst = !addresses || addresses.length === 0;
        const { error } = await supabase.from("user_addresses").insert({ ...payload, is_default: isFirst });
        if (error) throw error;
        toast.success("Address saved");
      }
      reset();
      qc.invalidateQueries({ queryKey: ["addresses", user!.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(false); }
  };

  const setDefault = async (id: string) => {
    const { error } = await supabase.from("user_addresses").update({ is_default: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Default address updated"); qc.invalidateQueries({ queryKey: ["addresses", user!.id] }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    const { error } = await supabase.from("user_addresses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["addresses", user!.id] });
  };

  const editRow = (a: AddressRow) => {
    setForm({ id: a.id, label: a.label, full_address: a.full_address, phone: a.phone });
    setLoc(a.lat && a.lng ? { lat: Number(a.lat), lng: Number(a.lng), accuracy: Number(a.location_accuracy ?? 0) } : null);
    setShowForm(true);
  };

  if (loading || !user) return <div className="phone-shell" />;

  return (
    <div className="phone-shell flex min-h-[100dvh] flex-col">
      <header className="px-5 pt-10 pb-4">
        <Link to="/home" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="mt-2 font-display text-3xl">Saved addresses</h1>
        <p className="text-sm text-muted-foreground">Home, office, hostel — pick at checkout in one tap</p>
      </header>

      <div className="flex-1 px-5 pb-6 space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : !addresses?.length ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No saved addresses yet
          </div>
        ) : (
          <ul className="space-y-2">
            {addresses.map((a) => {
              const Icon = iconFor(a.label);
              return (
                <li key={a.id} className="rounded-2xl bg-card p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-warm text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.label}</span>
                        {a.is_default && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{a.full_address}</p>
                      <p className="text-xs text-muted-foreground">📞 {a.phone}{a.lat ? " · 📍 GPS saved" : ""}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!a.is_default && (
                      <Button size="sm" variant="outline" onClick={() => setDefault(a.id)} className="rounded-full">
                        <Star className="h-3.5 w-3.5 mr-1" /> Set default
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => editRow(a)} className="rounded-full">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(a.id)} className="rounded-full text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="h-12 w-full rounded-xl shadow-soft">
            <Plus className="h-4 w-4 mr-1" /> Add new address
          </Button>
        ) : (
          <div className="rounded-2xl bg-card p-4 shadow-soft space-y-3">
            <h2 className="font-display text-lg">{form.id ? "Edit address" : "New address"}</h2>
            <div>
              <Label className="text-xs">Label</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {LABEL_PRESETS.map((p) => (
                  <button
                    key={p.value} type="button"
                    onClick={() => setForm({ ...form, label: p.value })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                      form.label === p.value ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                    }`}
                  >
                    {p.value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                inputMode="numeric" maxLength={10} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                placeholder="98xxxxxxxx" className="h-11 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Full address</Label>
              <Textarea
                value={form.full_address}
                onChange={(e) => setForm({ ...form, full_address: e.target.value })}
                placeholder="House no, street, area, landmark, city" className="rounded-xl" rows={3}
              />
            </div>
            <Button type="button" variant={loc ? "outline" : "default"} onClick={captureLoc} className="w-full rounded-xl">
              <Navigation className="h-4 w-4 mr-1" /> {loc ? `GPS saved (±${Math.round(loc.accuracy)}m)` : "Capture live location"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={save} disabled={busy} className="flex-1 rounded-xl shadow-soft">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save address"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
