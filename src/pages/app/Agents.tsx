import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Mic, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { INDUSTRIES } from "@/lib/industries";
import { useToast } from "@/hooks/use-toast";
import { WalletDropdown } from "@/components/app/WalletDropdown";

type Agent = {
  id: string;
  name: string;
  industry: string;
  created_at: string;
  first_message: string;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
};

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customIndustries, setCustomIndustries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { currentOrgId } = useOrg();
  const { toast } = useToast();

  const loadAgents = async () => {
    if (!currentOrgId) { setAgents([]); setLoading(false); return; }
    setLoading(true);
    
    // Load custom industries first to map names
    const { data: ciData } = await supabase
      .from("custom_industries" as any)
      .select("id,name")
      .eq("org_id", currentOrgId);
    setCustomIndustries(ciData ?? []);

    const { data } = await supabase
      .from("agents")
      .select("id,name,industry,created_at,first_message,inbound_enabled,outbound_enabled")
      .eq("org_id", currentOrgId)
      .order("created_at", { ascending: false });
    setAgents((data as Agent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAgents(); /* eslint-disable-next-line */ }, [currentOrgId]);

  const getIndustryName = (industryId: string) => {
    const ind = INDUSTRIES.find((i) => i.id === industryId);
    if (ind) return ind.name;
    
    if (industryId.startsWith("custom-")) {
      const ciId = industryId.replace("custom-", "");
      const ci = customIndustries.find((x) => x.id === ciId);
      return ci?.name || "Custom Industry";
    }
    
    return industryId;
  };

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    const { error } = await supabase.from("agents").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast({ title: "Could not delete agent", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Agent deleted" });
    loadAgents();
  };

  return (
    <>
      <PageHeader title="Agents" description="Voice AI agents you've created." actions={
        <div className="flex items-center gap-3">
          <WalletDropdown />
          <Button asChild><Link to="/app/agents/new"><Plus className="h-4 w-4" /> New agent</Link></Button>
        </div>
      } />
      
      <div className="px-5 pb-6 sm:p-8 pt-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : agents.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Mic className="h-6 w-6" /></div>
            <h3 className="mt-5 font-display text-2xl tracking-tight">No agents yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">Create your first voice AI agent in under a minute. Pick an industry to get started.</p>
            <Button asChild className="mt-6"><Link to="/app/agents/new">Create your first agent</Link></Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => {
              const ind = INDUSTRIES.find((i) => i.id === a.industry);
              const Icon = ind?.icon ?? Bot;
              return (
                <Card key={a.id} className="p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev)]">
                  <Link to={`/app/agents/${a.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{getIndustryName(a.industry)}</div>
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">"{a.first_message}"</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.inbound_enabled && (
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Inbound
                        </span>
                      )}
                      {a.outbound_enabled && (
                        <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700">
                          Outbound
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAgent(a.id, a.name)}
                      disabled={deletingId === a.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === a.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Agents;
