ALTER TABLE public.dev_settings
ADD COLUMN IF NOT EXISTS telephony_provider text NOT NULL DEFAULT 'twilio',
ADD COLUMN IF NOT EXISTS fallback_voice_platform text NOT NULL DEFAULT 'vapi',
ADD COLUMN IF NOT EXISTS failover_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.integration_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  payload jsonb,
  response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_deliveries_org ON public.integration_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_status ON public.integration_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_next_retry ON public.integration_deliveries(next_retry_at);

ALTER TABLE public.integration_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_deliveries_select_org ON public.integration_deliveries;
DROP POLICY IF EXISTS integration_deliveries_insert_org ON public.integration_deliveries;
DROP POLICY IF EXISTS integration_deliveries_update_org ON public.integration_deliveries;
DROP POLICY IF EXISTS integration_deliveries_delete_org ON public.integration_deliveries;

CREATE POLICY integration_deliveries_select_org
ON public.integration_deliveries FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integration_deliveries_insert_org
ON public.integration_deliveries FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integration_deliveries_update_org
ON public.integration_deliveries FOR UPDATE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY integration_deliveries_delete_org
ON public.integration_deliveries FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

DROP TRIGGER IF EXISTS trg_integration_deliveries_set_updated_at ON public.integration_deliveries;
CREATE TRIGGER trg_integration_deliveries_set_updated_at
BEFORE UPDATE ON public.integration_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
