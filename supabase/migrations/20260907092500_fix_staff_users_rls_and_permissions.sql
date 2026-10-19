-- Fix RLS permissions for staff_users table to allow insert, update, delete
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Allow anon, authenticated, and service_role full access to staff_users and roles
GRANT ALL ON public.staff_users TO anon, authenticated, service_role;
GRANT ALL ON public.roles TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow public read access on staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "staff_users_public_all" ON public.staff_users;

CREATE POLICY "staff_users_public_all" ON public.staff_users
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Make pin optional (nullable) so staff can use only username and password
ALTER TABLE public.staff_users ALTER COLUMN pin DROP NOT NULL;
