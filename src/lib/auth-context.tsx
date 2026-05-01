import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAILS = ["admin@familyfood.in", "owner@familyfood.in"];

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isDeliveryBoy: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeliveryBoy, setIsDeliveryBoy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // detect delivery boy by checking if a delivery_boys row exists for this user
  useEffect(() => {
    if (!user) { setIsDeliveryBoy(false); return; }
    supabase.from("delivery_boys").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle()
      .then(({ data }) => setIsDeliveryBoy(!!data));
  }, [user]);

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, isDeliveryBoy, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

export const ADMIN_EMAIL_LIST = ADMIN_EMAILS;
