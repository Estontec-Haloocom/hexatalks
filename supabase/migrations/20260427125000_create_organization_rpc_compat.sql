-- Recreate create_organization with argument names/order that PostgREST
-- resolves in schema cache for RPC payloads.
DROP FUNCTION IF EXISTS public.create_organization(text, text, text);

CREATE OR REPLACE FUNCTION public.create_organization(
  _company_email text DEFAULT NULL,
  _company_phone text DEFAULT NULL,
  _name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _org_id uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF COALESCE(btrim(_name), '') = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.organizations (name, company_email, company_phone, owner_id, is_personal)
  VALUES (btrim(_name), NULLIF(_company_email, ''), NULLIF(_company_phone, ''), _uid, false)
  RETURNING id INTO _org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _uid, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text)
TO authenticated, service_role;
