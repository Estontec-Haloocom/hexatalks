CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS inbound_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS outbound_enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agents_at_least_one_direction_chk'
  ) THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT agents_at_least_one_direction_chk
      CHECK (inbound_enabled OR outbound_enabled);
  END IF;
END $$;
