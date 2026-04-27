import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Mail, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg, type OrgRole } from "@/contexts/OrgContext";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role: OrgRole;
  created_at: string;
  email?: string | null;
  full_name?: string | null;
};

const Organisation = () => {
  const { user } = useAuth();
  const { orgs, currentOrg, switchOrg, refresh, canManageCurrent } = useOrg();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    if (!currentOrg) return;
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from("organization_members")
      .select("id,user_id,invited_email,role,created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: true });
    if (error) {
      setLoadingMembers(false);
      toast({ title: "Could not load members", description: error.message, variant: "destructive" });
      return;
    }

    const userIds = Array.from(new Set((data ?? []).map((m: any) => m.user_id).filter(Boolean)));
    const profileById = new Map<string, { email: string | null; full_name: string | null }>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", userIds);
      (profiles ?? []).forEach((p: any) => {
        profileById.set(p.id, { email: p.email ?? null, full_name: p.full_name ?? null });
      });
    }

    const list: Member[] = (data ?? []).map((m: any) => {
      const profile = m.user_id ? profileById.get(m.user_id) : null;
      return {
        id: m.id,
        user_id: m.user_id,
        invited_email: m.invited_email,
        role: m.role,
        created_at: m.created_at,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
      };
    });
    setMembers(list);
    setLoadingMembers(false);
  };

  useEffect(() => { loadMembers(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  const createOrg = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("create_organization", {
      _company_email: null,
      _company_phone: null,
      _name: name.trim(),
    });
    if (error || !data) {
      setCreating(false);
      toast({ title: "Could not create organization", description: error?.message, variant: "destructive" });
      return;
    }
    setCreating(false);
    toast({ title: "Organization created" });
    await refresh();
    await switchOrg(data);
    setName(""); setCreateOpen(false);
  };

  const invite = async () => {
    if (!user || !currentOrg || !inviteEmail.trim()) return;
    setInviting(true);
    // Try to find existing user
    const { data: prof } = await supabase
      .from("profiles").select("id").ilike("email", inviteEmail.trim()).maybeSingle();
    const { error } = await supabase.from("organization_members").insert({
      organization_id: currentOrg.id,
      user_id: prof?.id ?? null,
      invited_email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });
    setInviting(false);
    if (error) { toast({ title: "Invite failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: prof ? "Member added" : "Invite recorded", description: prof ? "They now have access." : "They'll be added automatically when they sign up with this email." });
    setInviteEmail("");
    loadMembers();
  };

  const updateRole = async (m: Member, role: OrgRole) => {
    const { error } = await supabase.from("organization_members").update({ role }).eq("id", m.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    loadMembers();
  };

  const removeMember = async (m: Member) => {
    if (!confirm("Remove this member from the organization?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", m.id);
    if (error) { toast({ title: "Remove failed", description: error.message, variant: "destructive" }); return; }
    loadMembers();
  };

  return (
    <>
      <PageHeader
        title="Organisations"
        description="Switch between organisations to view their agents, numbers and calls in isolation."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New organisation</Button>}
      />

      <div className="space-y-6 px-5 py-6 sm:p-8">
        {/* Org cards */}
        <section>
          <h2 className="mb-3 font-display text-lg tracking-tight">Your organisations</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((o) => {
              const active = o.id === currentOrg?.id;
              return (
                <button key={o.id} onClick={() => switchOrg(o.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    active ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:border-accent/50 hover:bg-surface"
                  )}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{o.name}</div>
                        {active && <Check className="h-4 w-4 text-accent" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px]">{o.role}</Badge>
                        {o.is_personal && <Badge variant="outline" className="text-[10px]">Personal</Badge>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Current org details + members */}
        {currentOrg && (
          <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card className="p-5">
              <h3 className="font-semibold">{currentOrg.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Active organisation</p>
              <div className="mt-4 space-y-2 text-sm">
                {currentOrg.company_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />{currentOrg.company_email}
                  </div>
                )}
                {currentOrg.company_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-mono">☎</span>{currentOrg.company_phone}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Members</h3>
                <span className="text-xs text-muted-foreground">{members.length} total</span>
              </div>

              {canManageCurrent && (
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <Input placeholder="Email to invite" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={invite} disabled={inviting || !inviteEmail}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite
                  </Button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {loadingMembers ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No members yet.</div>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
                        {(m.full_name || m.email || m.invited_email || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {m.full_name || m.email || m.invited_email}
                          {m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                        </div>
                        {!m.user_id && <div className="text-[11px] text-muted-foreground">Invited — pending sign-up</div>}
                      </div>
                      {canManageCurrent && m.user_id !== currentOrg.owner_id ? (
                        <Select value={m.role} onValueChange={(v) => updateRole(m, v as OrgRole)}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] capitalize">{m.role}</Badge>
                      )}
                      {canManageCurrent && m.user_id !== currentOrg.owner_id && (
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Organisation name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Co." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createOrg} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Organisation;