CREATE TABLE IF NOT EXISTS public.custom_industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_industries_org ON public.custom_industries(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_industries_user ON public.custom_industries(user_id);

ALTER TABLE public.custom_industries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_industries_select_org ON public.custom_industries;
DROP POLICY IF EXISTS custom_industries_insert_org ON public.custom_industries;
DROP POLICY IF EXISTS custom_industries_update_org ON public.custom_industries;
DROP POLICY IF EXISTS custom_industries_delete_org ON public.custom_industries;

CREATE POLICY custom_industries_select_org
ON public.custom_industries
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY custom_industries_insert_org
ON public.custom_industries
FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);

CREATE POLICY custom_industries_update_org
ON public.custom_industries
FOR UPDATE
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY custom_industries_delete_org
ON public.custom_industries
FOR DELETE
USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]) OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_industries_set_updated_at ON public.custom_industries;
CREATE TRIGGER trg_custom_industries_set_updated_at
BEFORE UPDATE ON public.custom_industries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
