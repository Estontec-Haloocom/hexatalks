CREATE TABLE IF NOT EXISTS public.org_prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  format text NOT NULL DEFAULT 'json',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_prompt_configs_org ON public.org_prompt_configs(org_id);

ALTER TABLE public.org_prompt_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_prompt_configs_select_org ON public.org_prompt_configs;
DROP POLICY IF EXISTS org_prompt_configs_insert_org ON public.org_prompt_configs;
DROP POLICY IF EXISTS org_prompt_configs_update_org ON public.org_prompt_configs;
DROP POLICY IF EXISTS org_prompt_configs_delete_org ON public.org_prompt_configs;

CREATE POLICY org_prompt_configs_select_org
ON public.org_prompt_configs FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY org_prompt_configs_insert_org
ON public.org_prompt_configs FOR INSERT
WITH CHECK (
  public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
  AND auth.uid() = user_id
);

CREATE POLICY org_prompt_configs_update_org
ON public.org_prompt_configs FOR UPDATE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY org_prompt_configs_delete_org
ON public.org_prompt_configs FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

DROP TRIGGER IF EXISTS trg_org_prompt_configs_set_updated_at ON public.org_prompt_configs;
CREATE TRIGGER trg_org_prompt_configs_set_updated_at
BEFORE UPDATE ON public.org_prompt_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
