import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OrgRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  company_email: string | null;
  company_phone: string | null;
  owner_id: string;
  is_personal: boolean;
};

export type MemberOrg = Organization & { role: OrgRole };

type OrgCtx = {
  loading: boolean;
  orgs: MemberOrg[];
  currentOrg: MemberOrg | null;
  currentOrgId: string | null;
  switchOrg: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  hasNonPersonalOrg: boolean;
  canManageCurrent: boolean;
};

const Ctx = createContext<OrgCtx>({
  loading: true,
  orgs: [],
  currentOrg: null,
  currentOrgId: null,
  switchOrg: async () => {},
  refresh: async () => {},
  hasNonPersonalOrg: false,
  canManageCurrent: false,
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<MemberOrg[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setOrgs([]); setCurrentOrgId(null); setLoading(false); return; }
    setLoading(true);
    const loadMembershipData = async () => {
      const [{ data: members }, { data: profile }] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role, organization:organizations(id,name,company_email,company_phone,owner_id,is_personal)")
          .eq("user_id", user.id),
        supabase.from("profiles").select("current_org_id").eq("id", user.id).maybeSingle(),
      ]);
      const list: MemberOrg[] = (members ?? [])
        .map((m: any) => m.organization ? { ...(m.organization as Organization), role: m.role as OrgRole } : null)
        .filter(Boolean) as MemberOrg[];
      return { list, profile };
    };

    let { list, profile } = await loadMembershipData();
    if (list.length === 0) {
      // Self-heal org context for older/misaligned users and backfill legacy org_id rows.
      await supabase.rpc("ensure_user_org_context");
      const healed = await loadMembershipData();
      list = healed.list;
      profile = healed.profile;
    }

    list.sort((a, b) => Number(b.is_personal) - Number(a.is_personal) || a.name.localeCompare(b.name));
    setOrgs(list);
    let active = profile?.current_org_id ?? null;
    if (!active || !list.find((o) => o.id === active)) active = list[0]?.id ?? null;
    setCurrentOrgId(active);
    if (active && active !== profile?.current_org_id) {
      await supabase.from("profiles").update({ current_org_id: active }).eq("id", user.id);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const switchOrg = useCallback(async (orgId: string) => {
    if (!user) return;
    setCurrentOrgId(orgId);
    await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", user.id);
  }, [user?.id]);

  const value = useMemo<OrgCtx>(() => {
    const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;
    return {
      loading,
      orgs,
      currentOrg,
      currentOrgId,
      switchOrg,
      refresh,
      hasNonPersonalOrg: orgs.some((o) => !o.is_personal),
      canManageCurrent: !!currentOrg && (currentOrg.role === "owner" || currentOrg.role === "admin"),
    };
  }, [orgs, currentOrgId, loading, switchOrg, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useOrg = () => useContext(Ctx);