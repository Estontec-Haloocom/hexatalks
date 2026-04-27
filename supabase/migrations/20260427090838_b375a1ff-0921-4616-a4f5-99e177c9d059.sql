
-- 1. Role enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- 2. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_email text,
  company_phone text,
  owner_id uuid NOT NULL,
  is_personal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  invited_email text,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_om_updated BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_om_user ON public.organization_members(user_id);
CREATE INDEX idx_om_org ON public.organization_members(organization_id);

-- 4. Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- 5. Add current_org_id to profiles
ALTER TABLE public.profiles ADD COLUMN current_org_id uuid;

-- 6. Add org_id to all scoped tables (nullable for now; backfilled below)
ALTER TABLE public.agents              ADD COLUMN org_id uuid;
ALTER TABLE public.phone_numbers       ADD COLUMN org_id uuid;
ALTER TABLE public.calls               ADD COLUMN org_id uuid;
ALTER TABLE public.phone_number_agents ADD COLUMN org_id uuid;
ALTER TABLE public.feedback_agents     ADD COLUMN org_id uuid;
ALTER TABLE public.prompt_blocks       ADD COLUMN org_id uuid;
ALTER TABLE public.dev_settings        ADD COLUMN org_id uuid;

-- 7. Backfill: create a Personal org for every existing profile and migrate data
DO $$
DECLARE
  p record;
  new_org uuid;
BEGIN
  FOR p IN SELECT id, email FROM public.profiles LOOP
    INSERT INTO public.organizations (name, company_email, owner_id, is_personal)
    VALUES ('Personal', p.email, p.id, true)
    RETURNING id INTO new_org;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org, p.id, 'owner');

    UPDATE public.profiles SET current_org_id = new_org WHERE id = p.id;

    UPDATE public.agents              SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.phone_numbers       SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.calls               SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.phone_number_agents SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.feedback_agents     SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.prompt_blocks       SET org_id = new_org WHERE user_id = p.id;
    UPDATE public.dev_settings        SET org_id = new_org WHERE user_id = p.id;
  END LOOP;
END $$;

-- 8. Make org_id NOT NULL on tables that should always be org-scoped
ALTER TABLE public.agents              ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.phone_numbers       ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.phone_number_agents ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.feedback_agents     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.prompt_blocks       ALTER COLUMN org_id SET NOT NULL;

-- 9. Auto-create Personal org for newly signed-up users
CREATE OR REPLACE FUNCTION public.create_personal_org_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_org uuid;
BEGIN
  INSERT INTO public.organizations (name, company_email, owner_id, is_personal)
  VALUES ('Personal', NEW.email, NEW.id, true)
  RETURNING id INTO new_org;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org, NEW.id, 'owner');

  UPDATE public.profiles SET current_org_id = new_org WHERE id = NEW.id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profiles_personal_org
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_personal_org_for_new_user();

-- 10. Auto-link invited members when they sign up (match invited_email -> user)
CREATE OR REPLACE FUNCTION public.link_invited_org_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.organization_members
     SET user_id = NEW.id
   WHERE user_id IS NULL
     AND lower(invited_email) = lower(NEW.email);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profiles_link_invites
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_invited_org_members();

-- 11. RLS: organizations
CREATE POLICY orgs_select_member ON public.organizations FOR SELECT
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY orgs_insert_self ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY orgs_update_admin ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]));

-- 12. RLS: organization_members
CREATE POLICY om_select_member ON public.organization_members FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY om_insert_admin ON public.organization_members FOR INSERT
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']::public.org_role[])
    OR (
      -- allow self-insert when accepting an invite (user_id = self, row already exists is blocked by unique)
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om2
        WHERE om2.organization_id = organization_id
          AND om2.user_id IS NULL
          AND lower(om2.invited_email) = (SELECT lower(email) FROM public.profiles WHERE id = auth.uid())
      )
    )
  );
CREATE POLICY om_update_admin ON public.organization_members FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY om_delete_admin ON public.organization_members FOR DELETE
  USING (
    public.has_org_role(auth.uid(), organization_id, ARRAY['owner','admin']::public.org_role[])
    OR user_id = auth.uid()
  );

-- 13. Replace user-scoped policies with org-scoped policies on shared tables
-- agents
DROP POLICY IF EXISTS agents_select_own ON public.agents;
DROP POLICY IF EXISTS agents_insert_own ON public.agents;
DROP POLICY IF EXISTS agents_update_own ON public.agents;
DROP POLICY IF EXISTS agents_delete_own ON public.agents;
CREATE POLICY agents_select_org ON public.agents FOR SELECT USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY agents_insert_org ON public.agents FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);
CREATE POLICY agents_update_org ON public.agents FOR UPDATE USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY agents_delete_org ON public.agents FOR DELETE USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]) OR auth.uid() = user_id);

-- phone_numbers
DROP POLICY IF EXISTS numbers_select_own ON public.phone_numbers;
DROP POLICY IF EXISTS numbers_insert_own ON public.phone_numbers;
DROP POLICY IF EXISTS numbers_update_own ON public.phone_numbers;
DROP POLICY IF EXISTS numbers_delete_own ON public.phone_numbers;
CREATE POLICY numbers_select_org ON public.phone_numbers FOR SELECT USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY numbers_insert_org ON public.phone_numbers FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);
CREATE POLICY numbers_update_org ON public.phone_numbers FOR UPDATE USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY numbers_delete_org ON public.phone_numbers FOR DELETE USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]) OR auth.uid() = user_id);

-- calls
DROP POLICY IF EXISTS calls_select_own ON public.calls;
DROP POLICY IF EXISTS calls_insert_own ON public.calls;
DROP POLICY IF EXISTS calls_update_own ON public.calls;
CREATE POLICY calls_select_org ON public.calls FOR SELECT USING (org_id IS NULL AND auth.uid() = user_id OR public.is_org_member(auth.uid(), org_id));
CREATE POLICY calls_insert_org ON public.calls FOR INSERT WITH CHECK (auth.uid() = user_id AND (org_id IS NULL OR public.is_org_member(auth.uid(), org_id)));
CREATE POLICY calls_update_org ON public.calls FOR UPDATE USING (auth.uid() = user_id OR public.is_org_member(auth.uid(), org_id));

-- phone_number_agents
DROP POLICY IF EXISTS pna_select_own ON public.phone_number_agents;
DROP POLICY IF EXISTS pna_insert_own ON public.phone_number_agents;
DROP POLICY IF EXISTS pna_update_own ON public.phone_number_agents;
DROP POLICY IF EXISTS pna_delete_own ON public.phone_number_agents;
CREATE POLICY pna_select_org ON public.phone_number_agents FOR SELECT USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY pna_insert_org ON public.phone_number_agents FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);
CREATE POLICY pna_update_org ON public.phone_number_agents FOR UPDATE USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY pna_delete_org ON public.phone_number_agents FOR DELETE USING (public.is_org_member(auth.uid(), org_id));

-- feedback_agents
DROP POLICY IF EXISTS fba_select_own ON public.feedback_agents;
DROP POLICY IF EXISTS fba_insert_own ON public.feedback_agents;
DROP POLICY IF EXISTS fba_update_own ON public.feedback_agents;
DROP POLICY IF EXISTS fba_delete_own ON public.feedback_agents;
CREATE POLICY fba_select_org ON public.feedback_agents FOR SELECT USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY fba_insert_org ON public.feedback_agents FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);
CREATE POLICY fba_update_org ON public.feedback_agents FOR UPDATE USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY fba_delete_org ON public.feedback_agents FOR DELETE USING (public.is_org_member(auth.uid(), org_id));

-- prompt_blocks
DROP POLICY IF EXISTS prompt_blocks_select_own ON public.prompt_blocks;
DROP POLICY IF EXISTS prompt_blocks_insert_own ON public.prompt_blocks;
DROP POLICY IF EXISTS prompt_blocks_update_own ON public.prompt_blocks;
DROP POLICY IF EXISTS prompt_blocks_delete_own ON public.prompt_blocks;
CREATE POLICY pb_select_org ON public.prompt_blocks FOR SELECT USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY pb_insert_org ON public.prompt_blocks FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), org_id) AND auth.uid() = user_id);
CREATE POLICY pb_update_org ON public.prompt_blocks FOR UPDATE USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY pb_delete_org ON public.prompt_blocks FOR DELETE USING (public.is_org_member(auth.uid(), org_id));

-- dev_settings stays per-user but may carry an org_id (for org-scoped overrides later); keep existing policies.

-- 14. Indexes
CREATE INDEX idx_agents_org              ON public.agents(org_id);
CREATE INDEX idx_phone_numbers_org       ON public.phone_numbers(org_id);
CREATE INDEX idx_calls_org               ON public.calls(org_id);
CREATE INDEX idx_phone_number_agents_org ON public.phone_number_agents(org_id);
CREATE INDEX idx_feedback_agents_org     ON public.feedback_agents(org_id);
CREATE INDEX idx_prompt_blocks_org       ON public.prompt_blocks(org_id);
