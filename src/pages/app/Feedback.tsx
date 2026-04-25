import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, MessageSquareHeart, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string; industry: string };
type FeedbackRow = {
  id: string;
  name: string;
  source_agent_id: string;
  settings_mode: "same" | "new";
  trigger_type: "in_call" | "end_of_call" | "after_call";
  delay_minutes: number;
  prompt: string;
  question: string;
  active: boolean;
  created_at: string;
};

const TRIGGERS = [
  { value: "in_call", label: "In call" },
  { value: "end_of_call", label: "End of the call" },
  { value: "after_call", label: "After call" },
] as const;

const STEPS = ["Pick agent", "Settings mode", "Configure"];

const Feedback = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [mode, setMode] = useState<"same" | "new" | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("Politely let the caller know you'd love a few seconds of feedback to improve the experience. Keep it short and warm.");
  const [question, setQuestion] = useState("On a scale of 1 to 5, how would you rate the call you just had — and what could we do better?");
  const [trigger, setTrigger] = useState<"in_call" | "end_of_call" | "after_call">("after_call");
  const [delay, setDelay] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [a, f] = await Promise.all([
      supabase.from("agents").select("id,name,industry").order("created_at", { ascending: false }),
      supabase.from("feedback_agents").select("*").order("created_at", { ascending: false }),
    ]);
    setAgents((a.data as Agent[]) ?? []);
    setItems((f.data as FeedbackRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const sourceAgent = useMemo(() => agents.find((a) => a.id === sourceId), [agents, sourceId]);

  const reset = () => {
    setCreating(false); setStep(0); setSourceId(null); setMode(null);
    setName(""); setTrigger("after_call"); setDelay(5);
  };

  const save = async () => {
    if (!user || !sourceId || !mode) return;
    setSaving(true);
    const { error } = await supabase.from("feedback_agents").insert({
      user_id: user.id,
      name: name.trim() || `Feedback for ${sourceAgent?.name ?? "agent"}`,
      source_agent_id: sourceId,
      settings_mode: mode,
      trigger_type: trigger,
      delay_minutes: trigger === "after_call" ? Math.max(0, Number(delay) || 0) : 0,
      prompt: prompt.trim(),
      question: question.trim(),
    });
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Feedback agent created" });
    reset();
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("feedback_agents").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    refresh();
  };

  const canNext = (step === 0 && !!sourceId) || (step === 1 && !!mode);

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Collect feedback from callers automatically — in call, at the end, or scheduled after."
        actions={!creating && (
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create feedback agent</Button>
        )}
      />

      <div className="px-5 py-6 sm:px-8">
        {!creating ? (
          loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <Card className="grid place-items-center gap-3 p-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
                <MessageSquareHeart className="h-6 w-6" />
              </div>
              <div className="font-medium">No feedback agents yet</div>
              <p className="max-w-sm text-sm text-muted-foreground">Create a feedback agent to automatically gather caller sentiment after every conversation.</p>
              <Button onClick={() => setCreating(true)} className="mt-2"><Plus className="h-4 w-4" /> Create feedback agent</Button>
            </Card>
          ) : (
            <div className="grid gap-3">
              {items.map((it) => {
                const src = agents.find((a) => a.id === it.source_agent_id);
                return (
                  <Card key={it.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{it.name}</div>
                        <Badge variant="secondary">{it.settings_mode === "same" ? "Same agent" : "New agent"}</Badge>
                        <Badge variant="outline">
                          {it.trigger_type === "in_call" && "In call"}
                          {it.trigger_type === "end_of_call" && "End of call"}
                          {it.trigger_type === "after_call" && `After call · ${it.delay_minutes} min`}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">For agent: {src?.name ?? "—"}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">Q: {it.question}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(it.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          <div className="mx-auto max-w-2xl">
            {/* Stepper */}
            <div className="mb-6 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-medium",
                    i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="text-xs text-muted-foreground">{s}</div>
                  {i < STEPS.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>

            <Card className="p-5 sm:p-6">
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg">Select an agent</h2>
                    <p className="text-sm text-muted-foreground">Choose which agent this feedback flow attaches to.</p>
                  </div>
                  {agents.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No agents yet. <button className="text-accent underline" onClick={() => navigate("/app/agents/new")}>Create one</button>.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {agents.map((a) => (
                        <button key={a.id} onClick={() => setSourceId(a.id)}
                          className={cn("rounded-lg border p-3 text-left transition-colors",
                            sourceId === a.id ? "border-accent bg-accent-soft" : "hover:bg-secondary/60")}>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.industry}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg">How should the feedback agent be configured?</h2>
                    <p className="text-sm text-muted-foreground">Reuse the existing agent's voice & settings, or set up a brand new agent for feedback.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button onClick={() => setMode("same")}
                      className={cn("rounded-lg border p-4 text-left transition-colors",
                        mode === "same" ? "border-accent bg-accent-soft" : "hover:bg-secondary/60")}>
                      <div className="font-medium">Use same agent settings</div>
                      <div className="mt-1 text-xs text-muted-foreground">Same voice, language and persona as <span className="font-medium">{sourceAgent?.name}</span>.</div>
                    </button>
                    <button onClick={() => setMode("new")}
                      className={cn("rounded-lg border p-4 text-left transition-colors",
                        mode === "new" ? "border-accent bg-accent-soft" : "hover:bg-secondary/60")}>
                      <div className="font-medium">Create new agent settings</div>
                      <div className="mt-1 text-xs text-muted-foreground">Open the full agent wizard to configure a dedicated feedback agent.</div>
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg">Configure feedback</h2>
                    <p className="text-sm text-muted-foreground">Define how the agent should ask for feedback and when.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Feedback for ${sourceAgent?.name ?? "agent"}`} />
                  </div>

                  <div className="grid gap-2">
                    <Label>How should the agent ask for feedback? (prompt)</Label>
                    <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Question to ask</Label>
                    <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Trigger call</Label>
                      <Select value={trigger} onValueChange={(v) => setTrigger(v as typeof trigger)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {trigger === "after_call" && (
                      <div className="grid gap-2">
                        <Label>Minutes after call ends</Label>
                        <Input type="number" min={0} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => step === 0 ? reset() : setStep(step - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {step < 2 ? (
                  <Button
                    disabled={!canNext}
                    onClick={() => {
                      if (step === 1 && mode === "new") {
                        navigate("/app/agents/new");
                        return;
                      }
                      setStep(step + 1);
                    }}
                  >
                    {step === 1 && mode === "new" ? "Open agent wizard" : "Next"} <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={save} disabled={saving || !question.trim() || !prompt.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
};

export default Feedback;