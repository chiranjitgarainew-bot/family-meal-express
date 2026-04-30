-- Wipe seeded demo food items (orders preserved as snapshots in items jsonb)
DELETE FROM public.food_items;

-- Add live location columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric;

-- Reviews table: per-order food + delivery rating
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  food_rating int NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  delivery_rating int NOT NULL CHECK (delivery_rating BETWEEN 1 AND 5),
  food_comment text,
  delivery_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reviews or admin"
  ON public.order_reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users insert own reviews"
  ON public.order_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid() AND o.status = 'delivered')
  );

CREATE POLICY "Users update own reviews"
  ON public.order_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER order_reviews_touch_updated_at
  BEFORE UPDATE ON public.order_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_order_reviews_user ON public.order_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON public.orders(user_id, delivery_date DESC);