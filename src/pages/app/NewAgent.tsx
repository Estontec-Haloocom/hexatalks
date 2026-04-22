import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { INDUSTRIES, VOICES, LANGUAGES } from "@/lib/industries";
import { cn } from "@/lib/utils";

const STEPS = ["Industry", "Describe", "Voice", "Review"];

const NewAgent = () => {
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [voiceId, setVoiceId] = useState("jennifer");
  const [language, setLanguage] = useState("en-US");
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const ind = INDUSTRIES.find((i) => i.id === industry);

  const next = async () => {
    if (step === 0 && !industry) return;
    if (step === 1 && !systemPrompt) await generate();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const generate = async () => {
    if (!ind || !description.trim()) {
      toast({ title: "Add a description first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-agent-config", {
        body: { industry: ind.id, industryName: ind.name, description, starterPrompt: ind.starterPrompt },
      });
      if (error) throw error;
      setSystemPrompt(data.system_prompt);
      setFirstMessage(data.first_message);
      if (!name) setName(data.suggested_name || `${ind.name} Agent`);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      setSystemPrompt(ind.starterPrompt);
      setFirstMessage(ind.starterFirstMessage);
    } finally {
      setGenerating(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("agents").insert({
        user_id: user.id,
        name: name || `${ind?.name} Agent`,
        industry,
        description,
        system_prompt: systemPrompt,
        first_message: firstMessage,
        voice_id: voiceId,
        language,
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Agent created", description: "Open the Test tab to talk to it." });
      navigate(`/app/agents/${data.id}`);
    } catch (err: any) {
      toast({ title: "Could not create agent", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader title="New agent" description="Build a voice AI agent in 4 steps." />
      <div className="px-5 py-6 sm:p-8">
        {/* Progress */}
        <div className="mx-auto mb-8 flex max-w-3xl items-center gap-2 sm:gap-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2 sm:gap-3">
              <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                i < step ? "bg-success text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn("text-sm hidden sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-success" : "bg-border")} />}
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {step === 0 && (
                <Card className="p-5 sm:p-8">
                  <h2 className="font-display text-2xl tracking-tight">Pick your industry</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We'll pre-tune the prompt and voice for your use case.</p>
                  <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
                    {INDUSTRIES.map((i) => (
                      <button key={i.id} onClick={() => setIndustry(i.id)} className={cn(
                        "group rounded-xl border p-4 text-left transition-all sm:p-5",
                        industry === i.id ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:border-accent/50 hover:bg-surface"
                      )}>
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><i.icon className="h-4 w-4" /></div>
                          <div>
                            <div className="font-semibold">{i.name}</div>
                            <div className="text-sm text-muted-foreground">{i.tagline}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card className="p-5 sm:p-8">
                  <h2 className="font-display text-2xl tracking-tight">Describe your business</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Tell us what your agent should do. We'll write the prompt for you.</p>
                  <div className="mt-5 space-y-4 sm:mt-6">
                    <div className="space-y-1.5">
                      <Label>Agent name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${ind?.name} Receptionist`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Business description</Label>
                      <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`We run a ${ind?.name.toLowerCase()} business in downtown Seattle. The agent should handle…`} />
                    </div>
                    <Button onClick={generate} disabled={generating || !description} variant="outline" className="w-full">
                      {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate prompt with AI</>}
                    </Button>
                    {systemPrompt && (
                      <>
                        <div className="space-y-1.5">
                          <Label>First message</Label>
                          <Textarea rows={2} value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>System prompt</Label>
                          <Textarea rows={8} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card className="p-5 sm:p-8 space-y-6">
                  <div>
                    <h2 className="font-display text-2xl tracking-tight">Voice & language</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Choose the character your callers will hear.</p>
                  </div>
                  <div>
                    <Label className="mb-3 block">Character voice</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {VOICES.map((v) => (
                        <button key={v.id} onClick={() => setVoiceId(v.id)} className={cn(
                          "rounded-lg border p-3 text-left transition-all",
                          voiceId === v.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                        )}>
                          <div className="font-medium text-sm">{v.label}</div>
                          <div className="text-xs text-muted-foreground">{v.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-3 block">Language</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {LANGUAGES.map((l) => (
                        <button key={l.id} onClick={() => setLanguage(l.id)} className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                          language === l.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                        )}>{l.label}</button>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {step === 3 && (
                <Card className="p-5 sm:p-8 space-y-5">
                  <h2 className="font-display text-2xl tracking-tight">Review & create</h2>
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {[
                      ["Name", name],
                      ["Industry", ind?.name],
                      ["Voice", VOICES.find((v) => v.id === voiceId)?.label],
                      ["Language", LANGUAGES.find((l) => l.id === language)?.label],
                      ["First message", firstMessage],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="max-w-[60%] text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button onClick={create} disabled={creating} size="lg" className="w-full">
                    {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create agent"}
                  </Button>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="h-4 w-4" /> Back</Button>
            {step < STEPS.length - 1 && (
              <Button onClick={next} disabled={(step === 0 && !industry) || (step === 1 && !systemPrompt)}>Continue <ArrowRight className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NewAgent;
