-- ============ ROLES SYSTEM ============
CREATE TYPE public.app_role AS ENUM ('admin','delivery_boy','customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ SAVED ADDRESSES ============
CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_address text NOT NULL,
  phone text NOT NULL,
  lat numeric,
  lng numeric,
  location_accuracy numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses" ON public.user_addresses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all addresses" ON public.user_addresses
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_user_addresses_updated
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- enforce single default per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_single_default_address
  AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_address();

-- ============ DELIVERY BOYS ============
CREATE TABLE public.delivery_boys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_boys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage delivery boys" ON public.delivery_boys
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Delivery boy reads own row" ON public.delivery_boys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated read active delivery boys for assignment context"
  ON public.delivery_boys FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_delivery_boys_updated
  BEFORE UPDATE ON public.delivery_boys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ORDERS UPDATES ============
ALTER TABLE public.orders
  ADD COLUMN delivery_otp text,
  ADD COLUMN otp_verified_at timestamptz,
  ADD COLUMN delivery_boy_id uuid REFERENCES public.delivery_boys(id) ON DELETE SET NULL,
  ADD COLUMN cancel_reason text,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN delivery_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN address_id uuid REFERENCES public.user_addresses(id) ON DELETE SET NULL,
  ADD COLUMN admin_note text;

-- Generate OTP on insert
CREATE OR REPLACE FUNCTION public.assign_delivery_otp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.delivery_otp IS NULL THEN
    NEW.delivery_otp := lpad((floor(random() * 10000))::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_otp
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_delivery_otp();

-- Allow user to update own pending orders (edit/cancel)
CREATE POLICY "Users update own pending orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','confirmed'))
  WITH CHECK (auth.uid() = user_id);

-- Allow assigned delivery boy to view & update their orders
CREATE POLICY "Delivery boy views assigned orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    delivery_boy_id IN (SELECT id FROM public.delivery_boys WHERE user_id = auth.uid())
  );
CREATE POLICY "Delivery boy updates assigned orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    delivery_boy_id IN (SELECT id FROM public.delivery_boys WHERE user_id = auth.uid())
  )
  WITH CHECK (
    delivery_boy_id IN (SELECT id FROM public.delivery_boys WHERE user_id = auth.uid())
  );

-- ============ PROFILE PRIORITY TAG ============
CREATE TYPE public.priority_tag AS ENUM ('regular','vip','subscriber');
ALTER TABLE public.profiles
  ADD COLUMN priority public.priority_tag NOT NULL DEFAULT 'regular';

-- Admins should be able to view profiles for kitchen panel/customer history
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());