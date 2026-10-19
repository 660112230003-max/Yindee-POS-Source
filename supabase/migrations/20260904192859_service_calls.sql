-- ── Table ───────────────────────────────────────────────────
create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.tables(id) on delete cascade not null,
  message text default 'เรียกพนักงาน' not null,
  resolved boolean default false not null,
  created_at timestamp with time zone default now() not null
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.service_calls enable row level security;

-- Allow anonymous insertion (since customer QR flow uses anon access)
create policy "allow_anon_insert_service_calls"
  on public.service_calls
  for insert
  to anon
  with check (true);

-- Allow public read (staff needs to read it)
create policy "allow_public_read_service_calls"
  on public.service_calls
  for select
  using (true);

-- Allow public update (staff needs to resolve it)
create policy "allow_public_update_service_calls"
  on public.service_calls
  for update
  using (true)
  with check (true);
