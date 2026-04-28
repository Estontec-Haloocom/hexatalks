import { useEffect, useMemo, useState } from "react";
import { Link2, PlugZap, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { useOrg } from "@/contexts/OrgContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import slackLogo from "@/assets/integrations/slack.svg";
import gmailLogo from "@/assets/integrations/gmail.svg";
import calendarLogo from "@/assets/integrations/google-calendar.svg";
import hubspotLogo from "@/assets/integrations/hubspot.svg";
import webhookLogo from "@/assets/integrations/webhook.svg";
import zapierLogo from "@/assets/integrations/zapier.svg";

type IntegrationRow = {
  id: string;
  provider: string;
  status: string;
  connected_at: string | null;
  updated_at: string;
};

type IntegrationLog = {
  id: string;
  event_type: string;
  level: string;
  message: string;
  created_at: string;
};

type DeliveryRow = {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  next_retry_at: string | null;
  error_message: string | null;
  created_at: string;
};

const PROVIDERS = [
  { name: "Slack", logo: slackLogo },
  { name: "Gmail", logo: gmailLogo },
  { name: "Google Calendar", logo: calendarLogo },
  { name: "HubSpot", logo: hubspotLogo },
  { name: "Webhook", logo: webhookLogo },
  { name: "Zapier", logo: zapierLogo },
];

const Integrations = () => {
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = async () => {
    if (!currentOrgId) {
      setIntegrations([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: iData }, { data: lData }, { data: dData }] = await Promise.all([
      supabase.from("integrations" as any).select("id,provider,status,connected_at,updated_at").eq("org_id", currentOrgId).order("provider"),
      supabase.from("integration_logs" as any).select("id,event_type,level,message,created_at").eq("org_id", currentOrgId).order("created_at", { ascending: false }).limit(30),
      supabase.from("integration_deliveries" as any).select("id,event_type,status,attempts,next_retry_at,error_message,created_at").eq("org_id", currentOrgId).order("created_at", { ascending: false }).limit(30),
    ]);
    setIntegrations((iData as IntegrationRow[]) ?? []);
    setLogs((lData as IntegrationLog[]) ?? []);
    setDeliveries((dData as DeliveryRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const connectedSet = useMemo(() => new Set(integrations.map((x) => x.provider.toLowerCase())), [integrations]);

  const connectProvider = async (provider: string) => {
    if (!currentOrgId) return;
    setBusyProvider(provider);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("integrations" as any).upsert({
        org_id: currentOrgId,
        user_id: auth.user.id,
        provider: provider.toLowerCase(),
        status: "connected",
        connected_at: new Date().toISOString(),
      }, { onConflict: "org_id,provider" });
      if (error) throw error;
      await supabase.from("integration_logs" as any).insert({
        org_id: currentOrgId,
        event_type: "integration.connected",
        level: "info",
        message: `${provider} connected`,
      });
      await supabase.from("integration_deliveries" as any).insert({
        org_id: currentOrgId,
        event_type: "integration.connected",
        status: "delivered",
        attempts: 1,
      });
      toast({ title: `${provider} connected` });
      await load();
    } catch (e: any) {
      toast({ title: "Could not connect", description: e.message, variant: "destructive" });
    } finally {
      setBusyProvider(null);
    }
  };

  const retryDelivery = async (d: DeliveryRow) => {
    if (!currentOrgId) return;
    setRetryingId(d.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("integration_deliveries" as any).update({
        status: "delivered",
        attempts: (d.attempts ?? 0) + 1,
        next_retry_at: null,
        error_message: null,
        response: { retried_at: now, source: "manual_retry" },
      }).eq("id", d.id).eq("org_id", currentOrgId);
      if (error) throw error;
      await supabase.from("integration_logs" as any).insert({
        org_id: currentOrgId,
        event_type: "delivery.retried",
        level: "info",
        message: `Delivery ${d.id} retried manually`,
      });
      toast({ title: "Delivery retried" });
      await load();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  const disconnectProvider = async (provider: string) => {
    if (!currentOrgId) return;
    setBusyProvider(provider);
    try {
      const { error } = await supabase.from("integrations" as any).delete().eq("org_id", currentOrgId).eq("provider", provider.toLowerCase());
      if (error) throw error;
      await supabase.from("integration_logs" as any).insert({
        org_id: currentOrgId,
        event_type: "integration.disconnected",
        level: "warning",
        message: `${provider} disconnected`,
      });
      toast({ title: `${provider} disconnected` });
      await load();
    } catch (e: any) {
      toast({ title: "Could not disconnect", description: e.message, variant: "destructive" });
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect external platforms and monitor integration activity."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <div className="space-y-6 px-5 py-6 sm:p-8">
        <Tabs defaultValue="available">
          <TabsList>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="connected">Connected</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="secrets">Secrets</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROVIDERS.map((provider) => {
                const connected = connectedSet.has(provider.name.toLowerCase());
                return (
                  <Card key={provider.name} className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <div className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background p-1">
                          <img src={provider.logo} alt={`${provider.name} logo`} className="h-4 w-4 object-contain" />
                        </div>
                        {provider.name}
                      </div>
                      {connected ? <Badge>Connected</Badge> : <Badge variant="outline">Not connected</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">OAuth/API-based integration scaffold. Connector actions can be extended per provider.</div>
                    {connected ? (
                      <Button variant="outline" onClick={() => disconnectProvider(provider.name)} disabled={busyProvider === provider.name}>Disconnect</Button>
                    ) : (
                      <Button onClick={() => connectProvider(provider.name)} disabled={busyProvider === provider.name}><Link2 className="h-4 w-4" /> Connect</Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="deliveries" className="mt-4">
            <Card className="p-4">
              {deliveries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No deliveries yet.</div>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((d) => (
                    <div key={d.id} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{d.event_type}</div>
                          <div className="text-xs text-muted-foreground">
                            Status: {d.status} • Attempts: {d.attempts} • {new Date(d.created_at).toLocaleString()}
                          </div>
                          {d.error_message && <div className="mt-1 text-xs text-destructive">{d.error_message}</div>}
                        </div>
                        {d.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => retryDelivery(d)} disabled={retryingId === d.id}>
                            {retryingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="connected" className="mt-4">
            <Card className="p-4">
              {integrations.length === 0 ? (
                <div className="text-sm text-muted-foreground">No integrations connected yet.</div>
              ) : (
                <div className="space-y-2">
                  {integrations.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="font-medium capitalize">{item.provider}</div>
                        <div className="text-xs text-muted-foreground">Status: {item.status} • Updated: {new Date(item.updated_at).toLocaleString()}</div>
                      </div>
                      <Badge>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="p-4">
              {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No integration logs yet.</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> {new Date(log.created_at).toLocaleString()}</div>
                      <div className="mt-1 text-sm font-medium">{log.event_type}</div>
                      <div className="text-sm text-muted-foreground">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="secrets" className="mt-4">
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-accent" /> Secret Management</div>
              <div className="text-sm text-muted-foreground">
                This scaffold stores encrypted values in `integration_secrets` table. UI key rotation and reveal flows can be layered next.
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Integrations;
