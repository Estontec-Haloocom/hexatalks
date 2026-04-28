CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

CREATE TABLE IF NOT EXISTS public.integration_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  event_type text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON public.integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_secrets_org ON public.integration_secrets(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_org ON public.integration_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_select_org ON public.integrations;
DROP POLICY IF EXISTS integrations_insert_org ON public.integrations;
DROP POLICY IF EXISTS integrations_update_org ON public.integrations;
DROP POLICY IF EXISTS integrations_delete_org ON public.integrations;

CREATE POLICY integrations_select_org
ON public.integrations FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integrations_insert_org
ON public.integrations FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);

CREATE POLICY integrations_update_org
ON public.integrations FOR UPDATE
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integrations_delete_org
ON public.integrations FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

DROP POLICY IF EXISTS integration_secrets_select_org ON public.integration_secrets;
DROP POLICY IF EXISTS integration_secrets_insert_org ON public.integration_secrets;
DROP POLICY IF EXISTS integration_secrets_update_org ON public.integration_secrets;
DROP POLICY IF EXISTS integration_secrets_delete_org ON public.integration_secrets;

CREATE POLICY integration_secrets_select_org
ON public.integration_secrets FOR SELECT
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY integration_secrets_insert_org
ON public.integration_secrets FOR INSERT
WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY integration_secrets_update_org
ON public.integration_secrets FOR UPDATE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY integration_secrets_delete_org
ON public.integration_secrets FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

DROP POLICY IF EXISTS integration_logs_select_org ON public.integration_logs;
DROP POLICY IF EXISTS integration_logs_insert_org ON public.integration_logs;
DROP POLICY IF EXISTS integration_logs_update_org ON public.integration_logs;
DROP POLICY IF EXISTS integration_logs_delete_org ON public.integration_logs;

CREATE POLICY integration_logs_select_org
ON public.integration_logs FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integration_logs_insert_org
ON public.integration_logs FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY integration_logs_update_org
ON public.integration_logs FOR UPDATE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY integration_logs_delete_org
ON public.integration_logs FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

DROP TRIGGER IF EXISTS trg_integrations_set_updated_at ON public.integrations;
CREATE TRIGGER trg_integrations_set_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_integration_secrets_set_updated_at ON public.integration_secrets;
CREATE TRIGGER trg_integration_secrets_set_updated_at
BEFORE UPDATE ON public.integration_secrets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
