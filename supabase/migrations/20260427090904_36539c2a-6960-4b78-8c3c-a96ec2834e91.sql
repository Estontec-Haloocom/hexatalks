
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_personal_org_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_invited_org_members() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
