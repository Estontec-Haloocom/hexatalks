-- Fix PostgREST errors on org-scoped tables by ensuring
-- policy helper functions and table privileges are executable
-- by API roles.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated, service_role;

-- Optional read access for anon role remains controlled by RLS.
GRANT SELECT ON TABLE public.organizations TO anon;
GRANT SELECT ON TABLE public.organization_members TO anon;
