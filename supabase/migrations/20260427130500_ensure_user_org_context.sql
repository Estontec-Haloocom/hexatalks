CREATE OR REPLACE FUNCTION public.ensure_user_org_context()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _email text;
  _org_id uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  -- Ensure profile exists (for old/inconsistent accounts).
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, _email, COALESCE(_email, 'User'))
  ON CONFLICT (id) DO NOTHING;

  -- Use current membership if available.
  SELECT organization_id INTO _org_id
  FROM public.organization_members
  WHERE user_id = _uid
  ORDER BY created_at ASC
  LIMIT 1;

  -- Create a personal org if none exists yet.
  IF _org_id IS NULL THEN
    INSERT INTO public.organizations (name, company_email, owner_id, is_personal)
    VALUES ('Personal', _email, _uid, true)
    RETURNING id INTO _org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (_org_id, _uid, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.profiles
  SET current_org_id = _org_id
  WHERE id = _uid
    AND (current_org_id IS NULL OR current_org_id <> _org_id);

  -- Backfill legacy rows where org_id was missing.
  UPDATE public.agents              SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.phone_numbers       SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.calls               SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.phone_number_agents SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.feedback_agents     SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.prompt_blocks       SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;
  UPDATE public.dev_settings        SET org_id = _org_id WHERE user_id = _uid AND org_id IS NULL;

  RETURN _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_org_context() TO authenticated, service_role;
