CREATE TYPE public.kitchen_ticket_status AS ENUM ('sent','received','cooking','done','cancelled');
CREATE TYPE public.kitchen_channel AS ENUM ('manual','api');

CREATE TABLE public.kitchen_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  station text NOT NULL DEFAULT 'main',
  channel public.kitchen_channel NOT NULL DEFAULT 'manual',
  status public.kitchen_ticket_status NOT NULL DEFAULT 'sent',
  note text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kitchen_tickets_order ON public.kitchen_tickets(order_id);
CREATE INDEX idx_kitchen_tickets_status ON public.kitchen_tickets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_tickets TO anon, authenticated;
GRANT ALL ON public.kitchen_tickets TO service_role;

ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kitchen_tickets public access" ON public.kitchen_tickets FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_kitchen_tickets_updated BEFORE UPDATE ON public.kitchen_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_tickets;