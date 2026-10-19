-- Migration: 20260904095000_anonymous_qr_ordering_access.sql
-- Allow public (anonymous) read access to menu, categories, promotions, store settings, and tables
-- Allow public (anonymous) insert & select access to orders and order_items for table QR ordering

-- Enable RLS on core tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT SELECT, UPDATE ON public.tables TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;

-- Public read policies for menu & store data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_public_read') THEN
    CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_items' AND policyname = 'menu_items_public_read') THEN
    CREATE POLICY "menu_items_public_read" ON public.menu_items FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'promotions' AND policyname = 'promotions_public_read') THEN
    CREATE POLICY "promotions_public_read" ON public.promotions FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_settings' AND policyname = 'store_settings_public_read') THEN
    CREATE POLICY "store_settings_public_read" ON public.store_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tables' AND policyname = 'tables_public_read') THEN
    CREATE POLICY "tables_public_read" ON public.tables FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tables' AND policyname = 'tables_public_update') THEN
    CREATE POLICY "tables_public_update" ON public.tables FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  -- Orders & Order Items policies for customer QR ordering & order status tracking
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_public_insert') THEN
    CREATE POLICY "orders_public_insert" ON public.orders FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_public_select') THEN
    CREATE POLICY "orders_public_select" ON public.orders FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_public_update') THEN
    CREATE POLICY "orders_public_update" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_public_insert') THEN
    CREATE POLICY "order_items_public_insert" ON public.order_items FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_public_select') THEN
    CREATE POLICY "order_items_public_select" ON public.order_items FOR SELECT USING (true);
  END IF;
END $$;
