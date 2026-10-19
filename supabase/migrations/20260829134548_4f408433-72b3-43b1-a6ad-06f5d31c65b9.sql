-- Enums
CREATE TYPE public.menu_status AS ENUM ('available','out_of_stock');
CREATE TYPE public.table_zone AS ENUM ('indoor','terrace');
CREATE TYPE public.table_status AS ENUM ('available','occupied','disabled');
CREATE TYPE public.discount_type AS ENUM ('percentage','fixed_amount');
CREATE TYPE public.promo_status AS ENUM ('active','inactive');
CREATE TYPE public.order_type AS ENUM ('dine_in','takeaway');
CREATE TYPE public.order_status AS ENUM ('waiting','in_kitchen','served','completed','cancelled');

-- Timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public access" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- menu_items
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text,
  is_popular boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  status public.menu_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items public access" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tables
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  zone public.table_zone NOT NULL DEFAULT 'indoor',
  status public.table_status NOT NULL DEFAULT 'available',
  qr_code_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables TO anon, authenticated;
GRANT ALL ON public.tables TO service_role;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables public access" ON public.tables FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- promotions
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  discount_type public.discount_type NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_spend numeric NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  banner_url text,
  status public.promo_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO anon, authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions public access" ON public.promotions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  order_type public.order_type NOT NULL DEFAULT 'dine_in',
  customer_name text NOT NULL DEFAULT '',
  customer_count int NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public access" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- order_items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  menu_name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items public access" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- store_settings
CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'ร้านอาหารครัวคุณแม่',
  system_name text NOT NULL DEFAULT 'Restaurant OS',
  tagline text NOT NULL DEFAULT 'อร่อยทุกคำ อบอุ่นทุกจาน',
  logo_url text,
  banner_url text,
  hero_title text NOT NULL DEFAULT 'ยินดีต้อนรับ',
  hero_subtitle text NOT NULL DEFAULT 'สแกนสั่งอาหารได้เลยที่โต๊ะของคุณ',
  primary_color text NOT NULL DEFAULT '#E53E3E',
  secondary_color text NOT NULL DEFAULT '#10B981',
  vat_rate numeric NOT NULL DEFAULT 7,
  service_charge_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_settings public access" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- Seed
INSERT INTO public.categories (name, code, display_order) VALUES
  ('ยอดนิยม','CAT_POPULAR',1),
  ('อาหารจานเดียว','CAT_RICE',2),
  ('กับข้าว','CAT_DISH',3),
  ('เครื่องดื่ม','CAT_DRINK',4),
  ('ของหวาน','CAT_DESSERT',5);

INSERT INTO public.menu_items (code, name, category_id, price, description, image_url, is_popular, display_order, status) VALUES
  ('M001','ข้าวกะเพราหมูสับไข่ดาว',(SELECT id FROM public.categories WHERE code='CAT_RICE'),75,'กะเพราหอมกรอบ ผัดไฟแรง เสิร์ฟพร้อมไข่ดาวกรอบ','https://images.unsplash.com/photo-1569058242567-93de6f36f8e6?w=800&q=70',true,1,'available'),
  ('M002','ข้าวผัดกุ้ง',(SELECT id FROM public.categories WHERE code='CAT_RICE'),90,'ข้าวผัดหอมกลิ่นกระทะ กุ้งสดตัวโต','https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=70',true,2,'available'),
  ('M003','ข้าวหมูกรอบ',(SELECT id FROM public.categories WHERE code='CAT_RICE'),80,'หมูกรอบหนังกรุบ ราดน้ำจิ้มสูตรพิเศษ','https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=800&q=70',false,3,'available'),
  ('M004','ข้าวไก่ทอดกระเทียม',(SELECT id FROM public.categories WHERE code='CAT_RICE'),70,'ไก่ทอดกระเทียมหอมกรอบ','https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=70',false,4,'available'),
  ('M005','ผัดไทยกุ้งสด',(SELECT id FROM public.categories WHERE code='CAT_RICE'),95,'เส้นเหนียวนุ่ม รสกลมกล่อม','https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=70',true,5,'available'),
  ('M006','ต้มยำกุ้งน้ำข้น',(SELECT id FROM public.categories WHERE code='CAT_DISH'),180,'เข้มข้นจัดจ้าน กุ้งแม่น้ำตัวโต','https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=800&q=70',true,1,'available'),
  ('M007','ปลากะพงนึ่งมะนาว',(SELECT id FROM public.categories WHERE code='CAT_DISH'),320,'ปลาสดนึ่งน้ำมะนาวพริกสด','https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&q=70',false,2,'available'),
  ('M008','ผัดผักบุ้งไฟแดง',(SELECT id FROM public.categories WHERE code='CAT_DISH'),80,'ผัดไฟแรง กรอบสด','https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=70',false,3,'available'),
  ('M009','ยำวุ้นเส้นทะเล',(SELECT id FROM public.categories WHERE code='CAT_DISH'),140,'เปรี้ยวจี๊ดถึงเครื่อง ทะเลสดใหม่','https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=70',false,4,'available'),
  ('M010','ทอดมันกุ้ง',(SELECT id FROM public.categories WHERE code='CAT_DISH'),90,'เนื้อกุ้งบดผสมเครื่องเทศ ปั้นเป็นก้อนแล้วนำไปทอด','https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=70',false,5,'out_of_stock'),
  ('M011','ไก่สะเต๊ะ',(SELECT id FROM public.categories WHERE code='CAT_DISH'),85,'ไก่หมักเครื่องเทศย่างเตาถ่าน เสิร์ฟพร้อมน้ำจิ้มถั่ว','https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=70',false,6,'out_of_stock'),
  ('M012','ชาเย็น',(SELECT id FROM public.categories WHERE code='CAT_DRINK'),45,'ชาไทยแท้ หวานมัน','https://images.unsplash.com/photo-1558857563-b371033873b8?w=800&q=70',true,1,'available'),
  ('M013','น้ำมะนาวโซดา',(SELECT id FROM public.categories WHERE code='CAT_DRINK'),50,'สดชื่นซ่า ดับร้อน','https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=70',false,2,'available'),
  ('M014','น้ำเปล่า',(SELECT id FROM public.categories WHERE code='CAT_DRINK'),15,'น้ำดื่มบรรจุขวด','https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=70',false,3,'available'),
  ('M015','โค้กกระป๋อง',(SELECT id FROM public.categories WHERE code='CAT_DRINK'),25,'เย็นจัด','https://images.unsplash.com/photo-1554866585-cd94860890b7?w=800&q=70',false,4,'available'),
  ('M016','ข้าวเหนียวมะม่วง',(SELECT id FROM public.categories WHERE code='CAT_DESSERT'),120,'มะม่วงน้ำดอกไม้สุกหอม','https://images.unsplash.com/photo-1621293954908-907159247fc8?w=800&q=70',true,1,'available'),
  ('M017','บัวลอยไข่หวาน',(SELECT id FROM public.categories WHERE code='CAT_DESSERT'),60,'กะทิสดหอมมัน','https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=70',false,2,'available'),
  ('M018','ไอศกรีมกะทิ',(SELECT id FROM public.categories WHERE code='CAT_DESSERT'),55,'เสิร์ฟพร้อมถั่วลิสงคั่ว','https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=70',false,3,'available');

INSERT INTO public.tables (code, name, zone, status) VALUES
  ('T01','โต๊ะ 1','indoor','available'),
  ('T02','โต๊ะ 2','indoor','available'),
  ('T03','โต๊ะ 3','indoor','occupied'),
  ('T04','โต๊ะ 4','indoor','available'),
  ('T05','โต๊ะ 5','indoor','available'),
  ('T06','โต๊ะ 6','indoor','available'),
  ('T07','โต๊ะ 7','indoor','available'),
  ('T08','โต๊ะ 8','terrace','available'),
  ('T09','โต๊ะ 9','terrace','occupied'),
  ('T10','โต๊ะ 10','terrace','available'),
  ('T11','โต๊ะ 11','terrace','available'),
  ('T12','โต๊ะ 12','terrace','disabled'),
  ('T13','โต๊ะ 13','terrace','available');

INSERT INTO public.promotions (title, code, description, discount_type, discount_value, min_spend, start_date, end_date, status) VALUES
  ('ส่วนลด 10%','PROMO10','ลด 10% ทุกเมนู เมื่อสั่งครบ 300 บาท','percentage',10,300,CURRENT_DATE - 7, CURRENT_DATE + 60,'active'),
  ('โปรวันเกิด 15%','BDAY15','ลด 15% สำหรับลูกค้าวันเกิดเดือนนี้','percentage',15,0,CURRENT_DATE - 7, CURRENT_DATE + 60,'active'),
  ('ลดพิเศษ 50 บาท','SAVE50','ลดทันที 50 บาท เมื่อสั่งครบ 500 บาท','fixed_amount',50,500,CURRENT_DATE - 7, CURRENT_DATE + 30,'inactive');

INSERT INTO public.store_settings (store_name, system_name, tagline, hero_title, hero_subtitle, primary_color, secondary_color, vat_rate, service_charge_rate)
VALUES ('ครัวคุณแม่ Kitchen','Restaurant OS','อร่อยทุกคำ อบอุ่นทุกจาน','ยินดีต้อนรับสู่ครัวคุณแม่','สแกน สั่ง อร่อย ได้เลยที่โต๊ะของคุณ','#E53E3E','#10B981',7,0);