import { useEffect, useMemo, useState } from "react";
import { Phone, Plus, Bot, Trash2, Calendar as CalIcon, Link2, Link2Off, Loader2, Download, Upload, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/contexts/OrgContext";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { cn } from "@/lib/utils";

type PhoneNumber = { id: string; e164: string; label: string | null; vapi_number_id: string | null; twilio_sid: string | null };
type Agent = { id: string; name: string; industry: string; inbound_enabled: boolean; outbound_enabled: boolean };
type Assignment = {
  id: string;
  phone_number_id: string;
  agent_id: string;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  active: boolean;
};

const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const PhoneNumbers = () => {
  const { toast } = useToast();
  const { currentOrgId } = useOrg();
  const { settings } = useDevSettings();
  const providerLabel = settings.telephony_provider === "plivo" ? "Plivo" : settings.telephony_provider === "exotel" ? "Exotel" : "Twilio";
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add number form
  const [adding, setAdding] = useState(false);
  const [newE164, setNewE164] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSid, setNewSid] = useState("");
  const [importing, setImporting] = useState(false);

  // Agent dialog state
  const [openAgent, setOpenAgent] = useState<Agent | null>(null);
  const [pendingNumberId, setPendingNumberId] = useState("");
  const [pendingStart, setPendingStart] = useState("");
  const [pendingEnd, setPendingEnd] = useState("");
  const [pendingPriority, setPendingPriority] = useState(0);
  const [savingLink, setSavingLink] = useState(false);
  const [placingOutbound, setPlacingOutbound] = useState(false);
  const [outboundToNumber, setOutboundToNumber] = useState("");
  const [contactRawInput, setContactRawInput] = useState("");
  const [parsedContacts, setParsedContacts] = useState<string[]>([]);

  const load = async () => {
    if (!currentOrgId) { setNumbers([]); setAgents([]); setAssignments([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: n }, { data: a }, { data: pna }] = await Promise.all([
      supabase.from("phone_numbers").select("*").eq("org_id", currentOrgId).order("created_at", { ascending: false }),
      supabase.from("agents").select("id, name, industry, inbound_enabled, outbound_enabled").eq("org_id", currentOrgId).order("created_at", { ascending: false }),
      supabase.from("phone_number_agents").select("*").eq("org_id", currentOrgId),
    ]);
    setNumbers((n as PhoneNumber[]) ?? []);
    setAgents((a as Agent[]) ?? []);
    setAssignments((pna as Assignment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrgId]);

  const addNumber = async () => {
    if (!newE164.match(/^\+\d{6,15}$/)) {
      toast({ title: "Enter E.164 format (e.g. +15551234567)", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentOrgId) { setAdding(false); return; }
    const { error } = await supabase.from("phone_numbers").insert({
      user_id: user.id, org_id: currentOrgId, e164: newE164, label: newLabel || null, twilio_sid: newSid || null,
    });
    setAdding(false);
    if (error) { toast({ title: "Could not add number", description: error.message, variant: "destructive" }); return; }
    setNewE164(""); setNewLabel(""); setNewSid("");
    load();
  };

  const removeNumber = async (id: string) => {
    if (!confirm("Remove this number? It will be unlinked from all agents.")) return;
    const { error } = await supabase.from("phone_numbers").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const importFromProvider = async () => {
    setImporting(true);
    try {
      if (settings.telephony_provider !== "twilio") {
        toast({ title: `${providerLabel} import not supported`, description: "Only Twilio imports are supported in scaffold mode.", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("twilio-list-numbers");
      if (error) throw error;
      const list = (data?.numbers ?? []) as Array<{ sid: string; e164: string; label: string }>;
      if (list.length === 0) {
        toast({ title: `No ${providerLabel} numbers found on your account` });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentOrgId) return;
      const existing = new Set(numbers.map((n) => n.e164));
      const rows = list
        .filter((n) => !existing.has(n.e164))
        .map((n) => ({ user_id: user.id, org_id: currentOrgId, e164: n.e164, label: n.label || null, twilio_sid: n.sid }));
      if (rows.length === 0) {
        toast({ title: `All ${providerLabel} numbers already imported` });
        return;
      }
      const { error: insErr } = await supabase.from("phone_numbers").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `Imported ${rows.length} number${rows.length === 1 ? "" : "s"} from ${providerLabel}` });
      load();
    } catch (e: any) {
      toast({ title: `${providerLabel} import failed`, description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const assignmentsForAgent = (agentId: string) =>
    assignments
      .filter((x) => x.agent_id === agentId)
      .sort((a, b) => a.priority - b.priority);

  const numbersForAgent = (agentId: string) =>
    assignmentsForAgent(agentId)
      .map((x) => ({ assignment: x, number: numbers.find((n) => n.id === x.phone_number_id) }))
      .filter((x) => x.number);

  const agentsForNumber = (numberId: string) =>
    assignments.filter((x) => x.phone_number_id === numberId).map((x) => agents.find((a) => a.id === x.agent_id)).filter(Boolean) as Agent[];

  const availableNumbersForAgent = (agentId: string) => {
    const taken = new Set(assignmentsForAgent(agentId).map((x) => x.phone_number_id));
    return numbers.filter((n) => !taken.has(n.id));
  };

  const linkNumberToAgent = async () => {
    if (!openAgent || !pendingNumberId) return;
    setSavingLink(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentOrgId) { setSavingLink(false); return; }
    const { error } = await supabase.from("phone_number_agents").insert({
      user_id: user.id,
      org_id: currentOrgId,
      agent_id: openAgent.id,
      phone_number_id: pendingNumberId,
      starts_at: toIso(pendingStart),
      ends_at: toIso(pendingEnd),
      priority: pendingPriority,
      active: true,
    });
    setSavingLink(false);
    if (error) { toast({ title: "Could not link", description: error.message, variant: "destructive" }); return; }
    setPendingNumberId(""); setPendingStart(""); setPendingEnd(""); setPendingPriority(0);
    toast({ title: "Number linked", description: "The agent will answer on this number per your schedule." });
    load();
  };

  const normalizePhone = (value: string) => {
    let to = value.trim().replace(/[\s\-().]/g, "");
    if (to.startsWith("00")) to = "+" + to.slice(2);
    if (!to.startsWith("+")) to = "+" + to.replace(/^\+?/, "");
    return /^\+\d{8,15}$/.test(to) ? to : null;
  };

  const placeOutboundCall = async (phone: string) => {
    if (!openAgent) return;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast({ title: "Invalid number", description: "Use country code format like +919876543210", variant: "destructive" });
      return;
    }
    setPlacingOutbound(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-place-call", {
        body: { agentId: openAgent.id, toNumber: normalized },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Could not place call");
      toast({ title: "Call queued", description: `Calling ${normalized}...` });
      setOutboundToNumber("");
    } catch (err: any) {
      toast({ title: "Could not place call", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setPlacingOutbound(false);
    }
  };

  const parseContactsFromText = (raw: string) => {
    const contacts = raw
      .split(/[\n,;]+/)
      .map((x) => normalizePhone(x))
      .filter((x): x is string => !!x);
    setParsedContacts(contacts);
  };

  const uploadContacts = async (file: File) => {
    const text = await file.text();
    setContactRawInput(text);
    parseContactsFromText(text);
  };

  const scheduleInboundCalls = async () => {
    if (!openAgent) return;
    if (!pendingNumberId) {
      toast({ title: "Assign a number first", variant: "destructive" });
      return;
    }
    if (parsedContacts.length === 0) {
      toast({ title: "Add at least one contact", variant: "destructive" });
      return;
    }

    // Schedule: first assign the number
    setSavingLink(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentOrgId) { setSavingLink(false); return; }
    
    const { error } = await supabase.from("phone_number_agents").insert({
      user_id: user.id,
      org_id: currentOrgId,
      agent_id: openAgent.id,
      phone_number_id: pendingNumberId,
      starts_at: toIso(pendingStart),
      ends_at: toIso(pendingEnd),
      priority: pendingPriority,
      active: true,
    });
    
    setSavingLink(false);
    
    if (error) { 
      toast({ title: "Could not schedule", description: error.message, variant: "destructive" }); 
      return; 
    }

    // Clean up state
    setPendingNumberId(""); setPendingStart(""); setPendingEnd(""); setPendingPriority(0);
    setContactRawInput(""); setParsedContacts([]);
    
    toast({
      title: "Call scheduled",
      description: `${parsedContacts.length} contact(s) scheduled for ${openAgent.name}.`,
    });
    
    load();
    setOpenAgent(null); // Close the form
  };

  const unlink = async (id: string) => {
    const { error } = await supabase.from("phone_number_agents").delete().eq("id", id);
    if (error) { toast({ title: "Unlink failed", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const numLabel = (n?: PhoneNumber) => n ? (n.label ? `${n.label} · ${n.e164}` : n.e164) : "—";
  const scheduleLabel = (a: Assignment) => {
    if (!a.starts_at && !a.ends_at) return "Always on";
    const s = a.starts_at ? format(new Date(a.starts_at), "MMM d, HH:mm") : "now";
    const e = a.ends_at ? format(new Date(a.ends_at), "MMM d, HH:mm") : "∞";
    return `${s} → ${e}`;
  };

  return (
    <>
      <PageHeader title="Phone numbers" description="Connect numbers to agents, share a number across agents, and schedule when each takes calls." />
      <div className="space-y-8 px-5 py-6 sm:p-8">
        {/* Numbers section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">Your numbers</h2>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={importFromProvider} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import from {providerLabel}
              </Button>
              <span className="text-xs text-muted-foreground">{numbers.length} total</span>
            </div>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs">E.164 number</Label>
                <Input placeholder="+15551234567" value={newE164} onChange={(e) => setNewE164(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label (optional)</Label>
                <Input placeholder="Sales line" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{providerLabel} SID / ID (optional)</Label>
                <Input placeholder="PNxxxxxxxx" value={newSid} onChange={(e) => setNewSid(e.target.value)} />
              </div>
              <Button onClick={addNumber} disabled={adding} className="self-end">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>
          </Card>

          {numbers.length === 0 ? (
            <Card className="mt-4 grid place-items-center p-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Phone className="h-5 w-5" /></div>
              <p className="mt-3 text-sm text-muted-foreground">No numbers yet. Add one above to start linking it to your agents.</p>
            </Card>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {numbers.map((n) => {
                const linked = agentsForNumber(n.id);
                return (
                  <Card key={n.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-accent" />
                          <span className="font-mono text-sm font-medium">{n.e164}</span>
                        </div>
                        {n.label && <div className="mt-0.5 text-xs text-muted-foreground">{n.label}</div>}
                      </div>
                      <button onClick={() => removeNumber(n.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="text-[11px] uppercase text-muted-foreground">Connected agents</div>
                      {linked.length === 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground">Not linked yet — pick an agent below.</div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {linked.map((a) => (
                            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                              <Bot className="h-3 w-3" />{a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Agents section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">Your agents</h2>
            <span className="text-xs text-muted-foreground">Click an agent to manage number connection by direction</span>
          </div>

          {loading ? (
            <div className="grid h-32 place-items-center text-sm text-muted-foreground">Loading…</div>
          ) : agents.length === 0 ? (
            <Card className="grid place-items-center p-10 text-center text-sm text-muted-foreground">No agents yet.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => {
                const linked = numbersForAgent(a.id);
                return (
                  <button key={a.id} onClick={() => setOpenAgent(a)} className="text-left">
                    <Card className="p-4 transition-all hover:border-accent hover:shadow-[var(--shadow-elev)]">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{a.name}</div>
                          <div className="text-xs capitalize text-muted-foreground">{a.industry}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {a.inbound_enabled && <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Inbound</span>}
                            {a.outbound_enabled && <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700">Outbound</span>}
                          </div>
                        </div>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px]",
                          linked.length > 0 ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>
                          {linked.length} number{linked.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {linked.length > 0 && (
                        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                          {linked.slice(0, 3).map(({ assignment, number }) => (
                            <div key={assignment.id} className="flex items-center gap-2 text-xs">
                              <span className={cn("h-1.5 w-1.5 rounded-full", assignment.active ? "bg-success" : "bg-muted-foreground")} />
                              <span className="font-mono">{number?.e164}</span>
                              <span className="ml-auto text-muted-foreground">{scheduleLabel(assignment)}</span>
                            </div>
                          ))}
                          {linked.length > 3 && <div className="text-[11px] text-muted-foreground">+{linked.length - 3} more…</div>}
                        </div>
                      )}
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Agent → numbers dialog */}
      <Dialog open={!!openAgent} onOpenChange={(o) => !o && setOpenAgent(null)}>
      <DialogContent className="max-h-[85vh] w-[90vw] max-w-md overflow-hidden rounded-2xl p-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> {openAgent?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {openAgent?.outbound_enabled ? "Outbound: assign number, set schedule, and add contacts." : "Inbound: assign/remove number only."}
            </p>
          </DialogHeader>

          {openAgent && (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {/* Existing assignments */}
              <div>
                <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Connected numbers</div>
                {numbersForAgent(openAgent.id).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    No numbers linked yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {numbersForAgent(openAgent.id).map(({ assignment, number }) => (
                      <div key={assignment.id} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background p-2">
                        <Phone className="h-4 w-4 text-accent" />
                        <div className="min-w-0">
                          <div className="font-mono text-xs">{number?.e164}</div>
                          {number?.label && <div className="text-[11px] text-muted-foreground">{number.label}</div>}
                        </div>
                        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><CalIcon className="h-3 w-3" />{scheduleLabel(assignment)}</span>
                          <button onClick={() => unlink(assignment.id)} className="text-muted-foreground hover:text-destructive" aria-label="Unlink">
                            <Link2Off className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add another number */}
              <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4" /> Connect a number
                </div>
                {availableNumbersForAgent(openAgent.id).length === 0 ? (
                  <div className="text-xs text-muted-foreground">All your numbers are already linked to this agent.</div>
                ) : (
                  <div className="grid gap-2.5">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Phone number</Label>
                      <select value={pendingNumberId} onChange={(e) => setPendingNumberId(e.target.value)}
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                        <option value="">Select a number…</option>
                        {availableNumbersForAgent(openAgent.id).map((n) => (
                          <option key={n.id} value={n.id}>{numLabel(n)}</option>
                        ))}
                      </select>
                    </div>
                    {openAgent.outbound_enabled && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Schedule date/time from</Label>
                          <Input className="h-9 rounded-lg" type="datetime-local" value={pendingStart} onChange={(e) => setPendingStart(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Schedule date/time until</Label>
                          <Input className="h-9 rounded-lg" type="datetime-local" value={pendingEnd} onChange={(e) => setPendingEnd(e.target.value)} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">Contacts (one per line or comma-separated)</Label>
                          <Textarea
                            rows={2}
                            value={contactRawInput}
                            onChange={(e) => {
                              setContactRawInput(e.target.value);
                              parseContactsFromText(e.target.value);
                            }}
                            className="min-h-[64px] rounded-lg"
                            placeholder="+919876543210, +14155550123"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">Or upload contacts file (.txt/.csv)</Label>
                          <Input
                            className="h-9 file:h-8 file:text-xs rounded-lg"
                            type="file"
                            accept=".txt,.csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadContacts(file);
                            }}
                          />
                        </div>
                      </>
                    )}
                    {!openAgent.outbound_enabled ? (
                      <div className="flex items-end mt-2">
                        <Button onClick={linkNumberToAgent} disabled={!pendingNumberId || savingLink} className="h-9 w-full rounded-lg">
                          {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Assign number
                        </Button>
                      </div>
                    ) : null}
                    
                    {!openAgent.outbound_enabled && (
                      <div className="grid gap-2 mt-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">Outbound destination number</Label>
                          <Input className="h-9 rounded-lg" value={outboundToNumber} onChange={(e) => setOutboundToNumber(e.target.value)} placeholder="+919876543210" />
                        </div>
                        <div className="sm:col-span-2">
                          <Button className="h-9 w-full rounded-lg" onClick={() => placeOutboundCall(outboundToNumber)} disabled={!outboundToNumber || placingOutbound}>
                            {placingOutbound ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Initiate call
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {openAgent.outbound_enabled && (
                      <div className="sm:col-span-2 grid grid-cols-2 gap-2 mt-4">
                        <Button className="h-9 w-full rounded-lg" onClick={() => placeOutboundCall(parsedContacts[0] ?? "")} disabled={parsedContacts.length === 0 || placingOutbound}>
                          {placingOutbound ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Initiate call
                        </Button>
                        <Button className="h-9 w-full rounded-lg" variant="outline" onClick={scheduleInboundCalls} disabled={savingLink}>
                          {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Schedule
                        </Button>
                        <span className="col-span-2 text-[11px] text-muted-foreground">{parsedContacts.length} valid contact(s)</span>
                      </div>
                    )}
                  </div>
                )}
                {openAgent.outbound_enabled ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Outbound mode: assign number, optionally set schedule window, then add contacts and initiate/schedule calls.
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Inbound mode: assign/remove numbers only.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAgent(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhoneNumbers;
