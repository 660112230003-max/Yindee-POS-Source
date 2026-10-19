create table public.roles (
  id text primary key,
  title text not null,
  description text,
  default_path text not null,
  badge text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.permissions (
  id text primary key,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.role_permissions (
  role_id text references public.roles(id) on delete cascade,
  permission_id text references public.permissions(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (role_id, permission_id)
);

create table public.staff_users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  pin text not null,
  role_id text references public.roles(id) on delete set null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_users enable row level security;

create policy "Allow public read access on roles" on public.roles for select using (true);
create policy "Allow public read access on permissions" on public.permissions for select using (true);
create policy "Allow public read access on role_permissions" on public.role_permissions for select using (true);
create policy "Allow public read access on staff_users" on public.staff_users for select using (true);

-- Seed basic roles
insert into public.roles (id, title, default_path, badge) values
  ('admin', 'เจ้าของร้าน / ผู้จัดการ (Admin Panel)', '/admin', '⚙️ ผู้ดูแลระบบ'),
  ('overview', 'รวมงานหน้าร้าน (Tablet Console)', '/all-in-one', '📱 รวม 3 แผนก'),
  ('cashier', 'แคชเชียร์ & รับออเดอร์ (Cashier & POS)', '/order-status', '🧾 แคชเชียร์ & POS'),
  ('staff', 'พนักงานเสิร์ฟ (Staff Queue)', '/staff', '🙋‍♂️ แผนกบริการ'),
  ('kitchen', 'ห้องครัว (Kitchen KDS)', '/kitchen', '👨‍🍳 แผนกห้องครัว');

-- Seed permissions
insert into public.permissions (id, description) values
  ('manage_menu', 'Manage food menu'),
  ('manage_tables', 'Manage tables'),
  ('view_reports', 'View sales reports'),
  ('cancel_order', 'Cancel an order'),
  ('void_bill', 'Void a bill'),
  ('apply_discount', 'Apply discounts'),
  ('access_kitchen', 'Access kitchen screen'),
  ('access_staff', 'Access staff screen'),
  ('access_pos', 'Access POS/Cashier screens'),
  ('access_overview', 'Access All-in-one screen');

-- Assign permissions to roles
insert into public.role_permissions (role_id, permission_id) values
  -- Admin gets everything
  ('admin', 'manage_menu'), ('admin', 'manage_tables'), ('admin', 'view_reports'),
  ('admin', 'cancel_order'), ('admin', 'void_bill'), ('admin', 'apply_discount'),
  ('admin', 'access_kitchen'), ('admin', 'access_staff'), ('admin', 'access_pos'), ('admin', 'access_overview'),
  
  -- Overview gets access to overview, kitchen, staff, pos
  ('overview', 'access_kitchen'), ('overview', 'access_staff'), ('overview', 'access_pos'), ('overview', 'access_overview'),
  
  -- Cashier gets POS access, plus order management
  ('cashier', 'access_pos'), ('cashier', 'cancel_order'), ('cashier', 'apply_discount'),
  
  -- Staff gets staff access
  ('staff', 'access_staff'),
  
  -- Kitchen gets kitchen access
  ('kitchen', 'access_kitchen');

-- Seed default users for testing (mimicking previous default PINs)
insert into public.staff_users (name, pin, role_id) values
  ('Admin Manager', '9999', 'admin'),
  ('Overview Tablet', '0000', 'overview'),
  ('Cashier 1', '3333', 'cashier'),
  ('Staff 1', '2222', 'staff'),
  ('Kitchen Staff', '1111', 'kitchen');
