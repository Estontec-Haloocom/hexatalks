import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Mic, Trash2, Wallet, Zap, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INDUSTRIES } from "@/lib/industries";
import { useToast } from "@/hooks/use-toast";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { cn } from "@/lib/utils";

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
  const { settings } = useDevSettings();

  const [walletBalances, setWalletBalances] = useState<{ vapi: number | null; ultravox: number | null }>({ vapi: null, ultravox: null });
  const [walletLoading, setWalletLoading] = useState(false);

  const fetchWalletBalances = async () => {
    setWalletLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.functions.invoke("vapi-web-token", {
          body: { action: "wallet", vapi_private_key: settings?.dev_mode_enabled ? settings.vapi_private_key : undefined }
        }),
        supabase.functions.invoke("ultravox-create-call", {
          body: { action: "wallet", ultravox_api_key: settings?.dev_mode_enabled ? settings.ultravox_api_key : undefined }
        })
      ]);

      const vapiRes = results[0].status === "fulfilled" ? results[0].value : null;
      const uvRes = results[1].status === "fulfilled" ? results[1].value : null;

      setWalletBalances({
        vapi: vapiRes?.data?.balance ?? null,
        ultravox: uvRes?.data?.balance ?? null
      });
    } catch (e) {
      console.error("Failed to fetch wallets", e);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletBalances();
  }, [settings?.dev_mode_enabled, settings?.vapi_private_key, settings?.ultravox_api_key]);

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
        <Button asChild><Link to="/app/agents/new"><Plus className="h-4 w-4" /> New agent</Link></Button>
      } />
      
      <div className="px-5 py-4 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Model V (Vapi) Wallet */}
          <Card className={cn(
            "relative overflow-hidden p-5 transition-all",
            settings?.voice_platform === "vapi" ? "border-primary/50 bg-primary/5 shadow-md" : "opacity-80"
          )}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold uppercase tracking-wider">Hexa Model V</h4>
                    {settings?.voice_platform === "vapi" && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Vapi.ai Core Engine</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground font-medium mb-0.5 flex items-center justify-end gap-1">
                  Wallet Balance
                  <button onClick={fetchWalletBalances} disabled={walletLoading} className="hover:text-primary transition-colors">
                    <RefreshCw className={cn("h-3 w-3", walletLoading && "animate-spin")} />
                  </button>
                </div>
                <div className="text-xl font-display font-bold tracking-tight">
                  {walletBalances.vapi !== null ? `$${walletBalances.vapi.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>
            {settings?.voice_platform === "vapi" && walletBalances.vapi !== null && walletBalances.vapi <= 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive font-bold border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-3.5 w-3.5" />
                No funds! Auto-failover to Model U active.
              </div>
            )}
            {settings?.voice_platform === "vapi" && (walletBalances.vapi ?? 0) > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 p-2 text-[11px] text-success font-bold border border-success/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                Engine healthy and ready.
              </div>
            )}
          </Card>

          {/* Model U (Ultravox) Wallet */}
          <Card className={cn(
            "relative overflow-hidden p-5 transition-all",
            settings?.voice_platform === "ultravox" ? "border-primary/50 bg-primary/5 shadow-md" : "opacity-80"
          )}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold uppercase tracking-wider">Hexa Model U</h4>
                    {settings?.voice_platform === "ultravox" && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Ultravox Native Intelligence</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground font-medium mb-0.5 flex items-center justify-end gap-1">
                  Wallet Balance
                  <button onClick={fetchWalletBalances} disabled={walletLoading} className="hover:text-primary transition-colors">
                    <RefreshCw className={cn("h-3 w-3", walletLoading && "animate-spin")} />
                  </button>
                </div>
                <div className="text-xl font-display font-bold tracking-tight">
                  {walletBalances.ultravox !== null ? `$${walletBalances.ultravox.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>
            {settings?.voice_platform === "ultravox" && walletBalances.ultravox !== null && walletBalances.ultravox <= 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive font-bold border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-3.5 w-3.5" />
                No funds! Auto-failover to Model V active.
              </div>
            )}
            {settings?.voice_platform === "ultravox" && (walletBalances.ultravox ?? 0) > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 p-2 text-[11px] text-success font-bold border border-success/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                Engine healthy and ready.
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="px-5 pb-6 sm:p-8 pt-0">
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
