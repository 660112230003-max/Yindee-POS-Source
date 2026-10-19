-- Enable Realtime publication for service_calls table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'service_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_calls;
  END IF;
END $$;

-- Set replica identity to full so update/delete events contain all columns
ALTER TABLE public.service_calls REPLICA IDENTITY FULL;

-- Ensure permissions for all roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_calls TO anon, authenticated;
GRANT ALL ON public.service_calls TO service_role;
