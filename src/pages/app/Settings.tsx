import { useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useDevSettings, type VoicePlatform, type TelephonyProvider } from "@/hooks/use-dev-settings";
import { usePromptBlocks, type PromptBlock } from "@/hooks/use-prompt-blocks";
import { useOrgPromptConfig, type OrgPromptFormat } from "@/hooks/use-org-prompt-config";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const PLATFORMS: { id: VoicePlatform; label: string; description: string }[] = [
  { id: "vapi", label: "Vapi", description: "Default. Web + outbound calling powered by Vapi." },
  { id: "ultravox", label: "Ultravox", description: "Ultra-low-latency speech-to-speech via Ultravox." },
];

const TEL_PROVIDERS: { id: TelephonyProvider; label: string; description: string }[] = [
  { id: "twilio", label: "Twilio", description: "Primary PSTN provider with current production edge functions." },
  { id: "plivo", label: "Plivo", description: "Alternative telephony provider (scaffold mode)." },
  { id: "exotel", label: "Exotel", description: "India-first telephony provider (scaffold mode)." },
];

const PROMPT_IDE_FORMATS: OrgPromptFormat[] = ["json", "python", "javascript", "markdown", "text"];

const Settings = () => {
  const { user } = useAuth();
  const { currentOrgId, hasNonPersonalOrg, refresh: refreshOrgs, switchOrg } = useOrg();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, update } = useDevSettings();
  const { blocks, refresh: refreshBlocks, loading: blocksLoading } = usePromptBlocks();
  const { config: orgPromptConfig, setConfig: setOrgPromptConfig, save: saveOrgPromptConfig, loading: orgPromptLoading } = useOrgPromptConfig();

  const [draft, setDraft] = useState<Record<string, PromptBlock>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingOrgPrompt, setSavingOrgPrompt] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  // Shift to Organization CTA
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftName, setShiftName] = useState("");
  const [shiftEmail, setShiftEmail] = useState(user?.email ?? "");
  const [shiftPhone, setShiftPhone] = useState("");
  const [shifting, setShifting] = useState(false);

  const createOrgFromSettings = async () => {
    if (!user || !shiftName.trim()) return;
    setShifting(true);
    const { data, error } = await supabase.rpc("create_organization", {
      _company_email: shiftEmail.trim() || null,
      _company_phone: shiftPhone.trim() || null,
      _name: shiftName.trim(),
    });
    if (error || !data) {
      setShifting(false);
      toast({ title: "Could not create organisation", description: error?.message, variant: "destructive" });
      return;
    }
    setShifting(false);
    toast({ title: "Organisation created", description: "You're now switched to your new organisation." });
    await refreshOrgs();
    await switchOrg(data);
    setShiftOpen(false); setShiftName(""); setShiftPhone("");
    navigate("/app/organisation");
  };

  useEffect(() => {
    const map: Record<string, PromptBlock> = {};
    blocks.forEach((b) => { map[b.id] = b; });
    setDraft(map);
  }, [blocks]);

  const updateBlock = (b: PromptBlock, patch: Partial<PromptBlock>) => {
    setDraft({ ...draft, [b.id]: { ...draft[b.id], ...patch } });
  };

  const saveBlock = async (id: string) => {
    const b = draft[id];
    if (!b) return;
    setSavingId(id);
    const { error } = await supabase.from("prompt_blocks")
      .update({ name: b.name, content: b.content, enabled: b.enabled, position: b.position })
      .eq("id", id);
    setSavingId(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Block saved" });
    refreshBlocks();
  };

  const toggleBlock = async (b: PromptBlock, enabled: boolean) => {
    updateBlock(b, { enabled });
    await supabase.from("prompt_blocks").update({ enabled }).eq("id", b.id);
  };

  const removeBlock = async (id: string) => {
    const { error } = await supabase.from("prompt_blocks").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    refreshBlocks();
  };

  const addBlock = async () => {
    if (!user || !currentOrgId || !newName.trim() || !newContent.trim()) return;
    const { error } = await supabase.from("prompt_blocks").insert({
      user_id: user.id,
      org_id: currentOrgId,
      name: newName.trim(),
      content: newContent.trim(),
      enabled: true,
      position: blocks.length,
    });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewContent(""); setAdding(false);
    refreshBlocks();
  };

  const saveOrgPromptIde = async () => {
    if (orgPromptConfig.format === "json" && orgPromptConfig.content.trim()) {
      try {
        JSON.parse(orgPromptConfig.content);
      } catch {
        toast({ title: "Invalid JSON", description: "Please fix JSON syntax before saving.", variant: "destructive" });
        return;
      }
    }
    setSavingOrgPrompt(true);
    await saveOrgPromptConfig(orgPromptConfig);
    setSavingOrgPrompt(false);
    toast({ title: "Organization Prompt IDE saved" });
  };

  return (
    <>
      <PageHeader title="Settings" description="Account, voice platform and developer tools." />
      <div className="space-y-4 px-5 py-6 sm:p-8">
        <Card className="p-6">
          <h3 className="font-semibold">Account</h3>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </Card>

        {!hasNonPersonalOrg && (
          <Card className="overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  <h3 className="font-display text-xl tracking-tight">Shift to Organisation</h3>
                </div>
                <p className="mt-2 text-sm opacity-85">
                  Move your workspace to a company organisation. Invite teammates, share agents, numbers and call data — all scoped per organisation.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setShiftOpen(true)}>
                <Plus className="h-4 w-4" /> Create organisation
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <h3 className="font-semibold">Developer mode</h3>
                {settings.dev_mode_enabled && <Badge variant="secondary">On</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the voice platform and inject custom prompt blocks into every agent globally.
              </p>
            </div>
            <Switch checked={settings.dev_mode_enabled} onCheckedChange={(v) => update({ dev_mode_enabled: v })} />
          </div>

          {settings.dev_mode_enabled && (
            <div className="mt-6 space-y-6 border-t border-border pt-6">
              <div className="grid gap-2 sm:max-w-sm">
                <Label>Voice platform</Label>
                <Select value={settings.voice_platform} onValueChange={(v) => update({ voice_platform: v as VoicePlatform })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {PLATFORMS.find((p) => p.id === settings.voice_platform)?.description}
                </p>
              </div>

              <div className="grid gap-2 sm:max-w-sm">
                <Label>Telephony provider</Label>
                <Select value={settings.telephony_provider} onValueChange={(v) => update({ telephony_provider: v as TelephonyProvider })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEL_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {TEL_PROVIDERS.find((p) => p.id === settings.telephony_provider)?.description}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Provider failover</h4>
                    <p className="text-xs text-muted-foreground">If primary runtime fails, fallback to backup voice platform automatically.</p>
                  </div>
                  <Switch checked={settings.failover_enabled} onCheckedChange={(v) => update({ failover_enabled: v })} />
                </div>
                {settings.failover_enabled && (
                  <div className="mt-3 grid gap-2 sm:max-w-sm">
                    <Label>Fallback voice platform</Label>
                    <Select value={settings.fallback_voice_platform} onValueChange={(v) => update({ fallback_voice_platform: v as VoicePlatform })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-4">
                  <h4 className="font-medium">Custom API Keys</h4>
                  <p className="text-xs text-muted-foreground">Override global platform keys with your own. When developer mode is off, global keys will be used.</p>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Vapi Public Key</Label>
                    <Input 
                      type="password" 
                      value={settings.vapi_public_key || ""} 
                      onChange={(e) => update({ vapi_public_key: e.target.value })} 
                      placeholder="pk_..." 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Vapi Private Key</Label>
                    <Input 
                      type="password" 
                      value={settings.vapi_private_key || ""} 
                      onChange={(e) => update({ vapi_private_key: e.target.value })} 
                      placeholder="sk_..." 
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Ultravox API Key</Label>
                    <Input 
                      type="password" 
                      value={settings.ultravox_api_key || ""} 
                      onChange={(e) => update({ ultravox_api_key: e.target.value })} 
                      placeholder="uv_..." 
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-6 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium">Organization Prompt IDE</h4>
                      <p className="text-xs text-muted-foreground">
                        Per-organization runtime prompt config. Supports JSON, Python, JavaScript, Markdown, or plain text.
                      </p>
                    </div>
                    <Switch
                      checked={orgPromptConfig.enabled}
                      onCheckedChange={(v) => setOrgPromptConfig({ ...orgPromptConfig, enabled: v })}
                      disabled={orgPromptLoading}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 sm:max-w-xs">
                    <Label>Format</Label>
                    <Select value={orgPromptConfig.format} onValueChange={(v) => setOrgPromptConfig({ ...orgPromptConfig, format: v as OrgPromptFormat })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROMPT_IDE_FORMATS.map((fmt) => (
                          <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <Label>Prompt IDE</Label>
                    <Textarea
                      rows={12}
                      value={orgPromptConfig.content}
                      onChange={(e) => setOrgPromptConfig({ ...orgPromptConfig, content: e.target.value })}
                      className="font-mono text-xs"
                      placeholder={
                        orgPromptConfig.format === "json"
                          ? `{\n  "companyTone": "professional",\n  "rules": ["confirm key details before ending"]\n}`
                          : "# Organization specific runtime instructions"
                      }
                    />
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={saveOrgPromptIde} disabled={savingOrgPrompt || orgPromptLoading}>
                      {savingOrgPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Prompt IDE
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Global prompt blocks</h4>
                    <p className="text-xs text-muted-foreground">Free-form named blocks injected into every agent's system prompt when enabled.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
                    <Plus className="h-4 w-4" /> {adding ? "Cancel" : "Add block"}
                  </Button>
                </div>

                {adding && (
                  <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border p-4">
                    <div className="grid gap-2">
                      <Label>Block name</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Brand voice, Safety rules" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Content</Label>
                      <Textarea rows={5} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Write the directive that should be added to every agent's system prompt…" />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addBlock} disabled={!newName.trim() || !newContent.trim()}>Save block</Button>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {blocksLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : blocks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No prompt blocks yet. Add one to enhance every agent globally.
                    </div>
                  ) : (
                    blocks.map((b) => {
                      const d = draft[b.id] ?? b;
                      return (
                        <div key={b.id} className="rounded-lg border border-border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={d.name}
                              onChange={(e) => updateBlock(b, { name: e.target.value })}
                              className="h-8 max-w-xs font-medium"
                            />
                            <div className="ml-auto flex items-center gap-2">
                              <Switch checked={d.enabled} onCheckedChange={(v) => toggleBlock(b, v)} />
                              <span className="text-xs text-muted-foreground">{d.enabled ? "Enabled" : "Disabled"}</span>
                              <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)} aria-label="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            rows={4}
                            value={d.content}
                            onChange={(e) => updateBlock(b, { content: e.target.value })}
                            className="mt-3 font-mono text-xs"
                          />
                          <div className="mt-3 flex justify-end">
                            <Button size="sm" variant="outline" onClick={() => saveBlock(b.id)} disabled={savingId === b.id}>
                              {savingId === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Create your organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Company name</Label>
              <Input value={shiftName} onChange={(e) => setShiftName(e.target.value)} placeholder="Acme Co." />
            </div>
            <div className="grid gap-1.5">
              <Label>Company email</Label>
              <Input type="email" value={shiftEmail} onChange={(e) => setShiftEmail(e.target.value)} placeholder="hello@acme.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Company phone</Label>
              <Input value={shiftPhone} onChange={(e) => setShiftPhone(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShiftOpen(false)}>Cancel</Button>
            <Button onClick={createOrgFromSettings} disabled={shifting || !shiftName.trim()}>
              {shifting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create & switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default Settings;
