-- Migration: Add username and password to staff_users table
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password text;

-- Seed default usernames for existing staff
UPDATE public.staff_users SET username = 'admin' WHERE role_id = 'admin' AND (username IS NULL OR username = '');
UPDATE public.staff_users SET username = 'overview' WHERE role_id = 'overview' AND (username IS NULL OR username = '');
UPDATE public.staff_users SET username = 'cashier1' WHERE role_id = 'cashier' AND (username IS NULL OR username = '');
UPDATE public.staff_users SET username = 'staff1' WHERE role_id = 'staff' AND (username IS NULL OR username = '');
UPDATE public.staff_users SET username = 'kitchen' WHERE role_id = 'kitchen' AND (username IS NULL OR username = '');
