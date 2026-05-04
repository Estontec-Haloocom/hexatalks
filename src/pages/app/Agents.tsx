import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Mic, Trash2, Wallet, Zap, ShieldCheck, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INDUSTRIES } from "@/lib/industries";
import { useToast } from "@/hooks/use-toast";
import { useDevSettings, type VoicePlatform } from "@/hooks/use-dev-settings";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { settings, update: updateSettings } = useDevSettings();

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

  const currentBalance = settings?.voice_platform === "vapi" ? walletBalances.vapi : walletBalances.ultravox;
  const currentModelName = settings?.voice_platform === "vapi" ? "Model V" : "Model U";

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-3 border-border/50 bg-background px-4 font-semibold shadow-sm hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", (currentBalance ?? 0) > 0 ? "bg-success animate-pulse" : "bg-destructive")} />
                  <span className="text-xs uppercase tracking-wider">{currentModelName}</span>
                </div>
                <div className="h-4 w-px bg-border/50" />
                <span className="text-sm">
                  {currentBalance !== null ? `$${currentBalance.toFixed(2)}` : "—"}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem 
                className="flex items-center justify-between gap-4 py-2.5"
                onClick={() => updateSettings({ voice_platform: "vapi" })}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Model V</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {walletBalances.vapi !== null ? `$${walletBalances.vapi.toFixed(2)}` : "—"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center justify-between gap-4 py-2.5"
                onClick={() => updateSettings({ voice_platform: "ultravox" })}
              >
                <div className="flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Model U</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {walletBalances.ultravox !== null ? `$${walletBalances.ultravox.toFixed(2)}` : "—"}
                </span>
              </DropdownMenuItem>
              <div className="border-t border-border mt-1 pt-1">
                <DropdownMenuItem 
                  className="flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); fetchWalletBalances(); }}
                  disabled={walletLoading}
                >
                  <RefreshCw className={cn("h-3 w-3", walletLoading && "animate-spin")} />
                  Refresh Balances
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
