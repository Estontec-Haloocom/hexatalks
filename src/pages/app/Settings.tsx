import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useDevSettings, type VoicePlatform } from "@/hooks/use-dev-settings";
import { usePromptBlocks, type PromptBlock } from "@/hooks/use-prompt-blocks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PLATFORMS: { id: VoicePlatform; label: string; description: string }[] = [
  { id: "vapi", label: "Vapi", description: "Default. Web + outbound calling powered by Vapi." },
  { id: "ultravox", label: "Ultravox", description: "Ultra-low-latency speech-to-speech via Ultravox." },
];

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings, update } = useDevSettings();
  const { blocks, refresh: refreshBlocks, loading: blocksLoading } = usePromptBlocks();

  const [draft, setDraft] = useState<Record<string, PromptBlock>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

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
    if (!user || !newName.trim() || !newContent.trim()) return;
    const { error } = await supabase.from("prompt_blocks").insert({
      user_id: user.id,
      name: newName.trim(),
      content: newContent.trim(),
      enabled: true,
      position: blocks.length,
    });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewContent(""); setAdding(false);
    refreshBlocks();
  };

  return (
    <>
      <PageHeader title="Settings" description="Account, voice platform and developer tools." />
      <div className="space-y-4 px-5 py-6 sm:p-8">
        <Card className="p-6">
          <h3 className="font-semibold">Account</h3>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </Card>

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

              <div>
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

        <Card className="p-6">
          <h3 className="font-semibold">Voice provider</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Active platform: <span className="font-medium text-foreground">{settings.voice_platform === "ultravox" ? "Ultravox" : "Vapi"}</span>.
            {settings.voice_platform === "ultravox"
              ? " All test, phone, and feedback calls route through Ultravox."
              : " All test, phone, and feedback calls route through Vapi."}
          </p>
        </Card>
      </div>
    </>
  );
};
export default Settings;