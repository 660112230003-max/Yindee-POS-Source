CREATE TYPE public.payment_method AS ENUM ('cash','transfer','card');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method public.payment_method NOT NULL DEFAULT 'cash',
  amount_due numeric NOT NULL DEFAULT 0,
  amount_received numeric NOT NULL DEFAULT 0,
  change_amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments public access" ON public.payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);