-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Admin allowlist function (email-based)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = ANY(ARRAY['admin@familyfood.in','owner@familyfood.in'])
  );
$$;

-- Meal type enum
CREATE TYPE public.meal_type AS ENUM ('lunch','dinner');
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled');

-- Food items
CREATE TABLE public.food_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  meal_type public.meal_type NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view food items" ON public.food_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food items" ON public.food_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Daily menu (which food items are featured on which date)
CREATE TABLE public.daily_menu (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_date DATE NOT NULL,
  food_item_id UUID NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(menu_date, food_item_id)
);
ALTER TABLE public.daily_menu ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view daily menu" ON public.daily_menu FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage daily menu" ON public.daily_menu FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  meal_type public.meal_type NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'upi',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  delivery_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Settings
CREATE TABLE public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES
  ('cutoff_times', '{"lunch":"10:00","dinner":"17:00"}'::jsonb),
  ('payment_methods', '{"upi":true,"card":true,"netbanking":true,"wallet":true,"cod":false}'::jsonb),
  ('delivery_info', '{"min_order":0,"delivery_fee":0,"currency":"INR"}'::jsonb);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_food_items_updated BEFORE UPDATE ON public.food_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed sample food items
INSERT INTO public.food_items (name, description, price, meal_type, is_available) VALUES
  ('Rice Meal (Bhāt Thali)', 'Steamed rice, dal, seasonal sabzi, salad, papad & pickle', 120, 'lunch', true),
  ('Veg Biryani', 'Aromatic basmati rice with mixed vegetables, raita & salan', 150, 'lunch', true),
  ('Chicken Curry Meal', 'Rice, chicken curry, dal, salad & papad', 180, 'lunch', true),
  ('Roti Meal', '4 fresh rotis, sabzi, dal, salad & pickle', 110, 'dinner', true),
  ('Paneer Butter Masala Thali', 'Rotis, paneer butter masala, jeera rice, salad', 170, 'dinner', true),
  ('Dal Tadka & Roti', '4 rotis, dal tadka, sabzi, salad', 100, 'dinner', true);