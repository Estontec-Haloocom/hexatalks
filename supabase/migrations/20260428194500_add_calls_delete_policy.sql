DROP POLICY IF EXISTS calls_delete_org ON public.calls;

CREATE POLICY calls_delete_org
ON public.calls
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_org_member(auth.uid(), org_id)
);
