import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Play, Pause, Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { INDUSTRIES } from "@/lib/industries";
import { useVoiceCatalog, type VoiceOption } from "@/hooks/use-voice-catalog";
import { useOrg } from "@/contexts/OrgContext";
import { cn } from "@/lib/utils";

const fmtErr = (value: any): string => {
  if (value == null) return "Unknown error";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(fmtErr).join(", ");
  if (typeof value === "object") return fmtErr(value.message ?? value.error ?? value.errorMsg ?? JSON.stringify(value));
  return String(value);
};
const isMissingRelationError = (value: any): boolean => {
  const code = value?.code;
  const message = String(value?.message ?? "");
  return code === "42P01" || message.includes("Could not find the table");
};

const STEPS = ["Direction", "Industry", "Describe", "Voice", "Review"];
const INDUSTRY_TYPES = [
  "Healthcare",
  "Real Estate",
  "Restaurant",
  "E-commerce",
  "Education",
  "Legal",
  "Finance",
  "Travel",
  "SaaS",
  "Other",
];

const COUNTRIES = [
  { id: "US", label: "🇺🇸 United States" },
  { id: "GB", label: "🇬🇧 United Kingdom" },
  { id: "IN", label: "🇮🇳 India" },
  { id: "AU", label: "🇦🇺 Australia" },
  { id: "CA", label: "🇨🇦 Canada" },
  { id: "IE", label: "🇮🇪 Ireland" },
  { id: "ZA", label: "🇿🇦 South Africa" },
  { id: "DE", label: "🇩🇪 Germany" },
  { id: "FR", label: "🇫🇷 France" },
  { id: "ES", label: "🇪🇸 Spain" },
  { id: "BR", label: "🇧🇷 Brazil" },
  { id: "MX", label: "🇲🇽 Mexico" },
];

const ACCENTS = ["American", "British", "Indian", "Australian", "Irish", "Scottish", "South African", "Canadian", "Neutral"];
const GENDERS = ["Female", "Male", "Neutral"];
const TONES = ["Professional & warm", "Friendly & casual", "Energetic & upbeat", "Calm & reassuring", "Confident & direct", "Empathetic & soft"];

const tokenIncludes = (haystack: string | undefined, needle: string) =>
  !!haystack && haystack.toLowerCase().includes(needle.toLowerCase());

const NewAgent = () => {
  const [step, setStep] = useState(0);
  const [describeStep, setDescribeStep] = useState<"details" | "prompt">("details");
  const [industry, setIndustry] = useState<string>("");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("US");
  const [accent, setAccent] = useState("American");
  const [gender, setGender] = useState("Female");
  const [tone, setTone] = useState(TONES[0]);
  const [useCases, setUseCases] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [customIndustries, setCustomIndustries] = useState<Array<{ id: string; name: string; industry_type: string }>>([]);
  const [customIndustryFeatureReady, setCustomIndustryFeatureReady] = useState(true);
  const [showCustomIndustryForm, setShowCustomIndustryForm] = useState(false);
  const [customIndustryName, setCustomIndustryName] = useState("");
  const [customIndustryType, setCustomIndustryType] = useState(INDUSTRY_TYPES[0]);
  const [savingCustomIndustry, setSavingCustomIndustry] = useState(false);
  const [editingCustomIndustryId, setEditingCustomIndustryId] = useState<string | null>(null);
  const [callDirection, setCallDirection] = useState<"inbound" | "outbound">("outbound");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: catalog } = useVoiceCatalog();
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const { currentOrgId } = useOrg();

  const mappedCustomIndustries = useMemo(() => {
    return customIndustries.map((ci) => ({
      id: `custom-${ci.id}`,
      name: ci.name,
      tagline: `${ci.industry_type} (Custom)`,
      icon: Building2,
      accent: "from-slate-500/20 to-slate-500/5",
      starterPrompt: `You are a professional voice assistant for ${ci.name} in the ${ci.industry_type} industry. Help callers with clear, concise, and friendly responses. Ask clarifying questions when needed and confirm important details before ending the call.`,
      starterFirstMessage: `Hi, thanks for calling ${ci.name}. How can I help you today?`,
      goals: ["Handle calls clearly", "Collect key information", "Route or resolve requests"],
    }));
  }, [customIndustries]);
  const allIndustries = useMemo(() => [...mappedCustomIndustries, ...INDUSTRIES], [mappedCustomIndustries]);
  const ind = allIndustries.find((i) => i.id === industry);
  const allVoices = catalog?.voices ?? [];
  const languages = catalog?.languages ?? [];

  const strictFilteredVoices = useMemo(() => {
    const langPrefix = language.slice(0, 2).toLowerCase();
    return allVoices.filter((v) => {
      const langOk = !v.language || v.language.toLowerCase().startsWith(langPrefix);
      const genderOk = gender === "Neutral" || !v.gender || tokenIncludes(v.gender, gender);
      const accentOk =
        accent === "Neutral" ||
        !v.accent ||
        tokenIncludes(v.accent, accent) ||
        tokenIncludes(v.country, accent) ||
        tokenIncludes(v.description, accent);
      return langOk && genderOk && accentOk;
    });
  }, [allVoices, language, gender, accent]);

  const languageOnlyVoices = useMemo(() => {
    const langPrefix = language.slice(0, 2).toLowerCase();
    return allVoices.filter((v) => !v.language || v.language.toLowerCase().startsWith(langPrefix));
  }, [allVoices, language]);

  const baseVoices = strictFilteredVoices.length ? strictFilteredVoices : languageOnlyVoices;
  const visibleVoices = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase();
    if (!q) return baseVoices;
    return baseVoices.filter((v) =>
      `${v.label} ${v.description} ${v.id} ${v.accent ?? ""} ${v.gender ?? ""} ${v.country ?? ""}`.toLowerCase().includes(q),
    );
  }, [baseVoices, voiceSearch]);
  const selectedVoice: VoiceOption | undefined =
    visibleVoices.find((v) => v.id === voiceId) ?? visibleVoices[0];

  useEffect(() => {
    if (!voiceId && visibleVoices.length > 0) setVoiceId(visibleVoices[0].id);
  }, [voiceId, visibleVoices]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const playPreview = (v: VoiceOption) => {
    if (previewing === v.id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
      setPreviewing(null);
      return;
    }
    if (!v.previewUrl) {
      toast({ title: "Preview unavailable", description: `No preview clip available for ${v.label}.`, variant: "destructive" });
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(v.previewUrl);
    previewAudioRef.current = audio;
    setPreviewing(v.id);
    audio.onended = () => {
      if (previewAudioRef.current === audio) previewAudioRef.current = null;
      setPreviewing(null);
    };
    audio.onerror = () => {
      if (previewAudioRef.current === audio) previewAudioRef.current = null;
      setPreviewing(null);
    };
    audio.play().catch(() => setPreviewing(null));
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const loadCustomIndustries = async () => {
    if (!currentOrgId) {
      setCustomIndustries([]);
      return;
    }
    const { data, error } = await supabase
      .from("custom_industries" as any)
      .select("id,name,industry_type")
      .eq("org_id", currentOrgId)
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingRelationError(error)) {
        setCustomIndustryFeatureReady(false);
        setCustomIndustries([]);
        return;
      }
      toast({ title: "Could not load custom industries", description: fmtErr(error), variant: "destructive" });
      return;
    }
    setCustomIndustryFeatureReady(true);
    setCustomIndustries((data as any[]) ?? []);
  };

  useEffect(() => {
    loadCustomIndustries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const saveCustomIndustry = async () => {
    if (!customIndustryName.trim()) {
      toast({ title: "Industry name required", variant: "destructive" });
      return;
    }
    if (!currentOrgId) {
      toast({ title: "No organisation selected", variant: "destructive" });
      return;
    }
    if (!customIndustryFeatureReady) {
      toast({
        title: "Custom industries are not enabled yet",
        description: "Run the latest Supabase migrations, then refresh this page.",
        variant: "destructive",
      });
      return;
    }
    setSavingCustomIndustry(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("custom_industries" as any).insert({
        org_id: currentOrgId,
        user_id: user.id,
        name: customIndustryName.trim(),
        industry_type: customIndustryType,
      }).select("id,name,industry_type").single();
      if (error) throw error;
      setCustomIndustries((prev) => [...prev, data as any]);
      setIndustry(`custom-${(data as any).id}`);
      setShowCustomIndustryForm(false);
      setCustomIndustryName("");
      toast({ title: "Custom industry created" });
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        setCustomIndustryFeatureReady(false);
        toast({
          title: "Custom industries are not enabled yet",
          description: "Run the latest Supabase migrations, then refresh this page.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Could not create industry", description: fmtErr(err), variant: "destructive" });
    } finally {
      setSavingCustomIndustry(false);
    }
  };

  const startEditCustomIndustry = (id: string) => {
    const current = customIndustries.find((x) => x.id === id);
    if (!current) return;
    setEditingCustomIndustryId(id);
    setShowCustomIndustryForm(true);
    setCustomIndustryName(current.name);
    setCustomIndustryType(current.industry_type);
  };

  const deleteCustomIndustry = async (id: string) => {
    if (!confirm("Delete this custom industry?")) return;
    try {
      const { error } = await supabase.from("custom_industries" as any).delete().eq("id", id);
      if (error) throw error;
      setCustomIndustries((prev) => prev.filter((x) => x.id !== id));
      if (industry === `custom-${id}`) setIndustry("");
      toast({ title: "Custom industry deleted" });
    } catch (err: any) {
      toast({ title: "Could not delete industry", description: fmtErr(err), variant: "destructive" });
    }
  };

  const upsertCustomIndustry = async () => {
    if (!customIndustryName.trim()) {
      toast({ title: "Industry name required", variant: "destructive" });
      return;
    }
    if (editingCustomIndustryId) {
      setSavingCustomIndustry(true);
      try {
        const { data, error } = await supabase.from("custom_industries" as any).update({
          name: customIndustryName.trim(),
          industry_type: customIndustryType,
        }).eq("id", editingCustomIndustryId).select("id,name,industry_type").single();
        if (error) throw error;
        setCustomIndustries((prev) => prev.map((x) => x.id === editingCustomIndustryId ? (data as any) : x));
        setIndustry(`custom-${(data as any).id}`);
        setEditingCustomIndustryId(null);
        setShowCustomIndustryForm(false);
        setCustomIndustryName("");
        toast({ title: "Custom industry updated" });
      } catch (err: any) {
        toast({ title: "Could not update industry", description: fmtErr(err), variant: "destructive" });
      } finally {
        setSavingCustomIndustry(false);
      }
      return;
    }
    await saveCustomIndustry();
  };

  const generate = async () => {
    if (!ind || !description.trim()) {
      toast({ title: "Add a description first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-agent-config", {
        body: {
          industry: ind.id,
          industryName: ind.name,
          description,
          starterPrompt: ind.starterPrompt,
          businessName,
          country,
          accent,
          gender,
          tone,
          language,
          useCases: useCases.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
        },
      });
      if (error) throw error;
      setSystemPrompt(data.system_prompt);
      setFirstMessage(data.first_message);
      if (!name) setName(data.suggested_name || `${ind.name} Agent`);
    } catch (err: any) {
      toast({ title: "Generation failed", description: fmtErr(err), variant: "destructive" });
      setSystemPrompt(ind.starterPrompt);
      setFirstMessage(ind.starterFirstMessage);
    } finally {
      setGenerating(false);
    }
  };

  const next = async () => {
    if (step === 1 && !industry) return;
    if (step === 2 && !systemPrompt) await generate();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const create = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (!currentOrgId) throw new Error("No organisation selected");
      const finalVoice = selectedVoice;
      const { data, error } = await supabase.from("agents").insert({
        user_id: user.id,
        org_id: currentOrgId,
        name: name || `${ind?.name} Agent`,
        industry,
        description,
        system_prompt: systemPrompt,
        first_message: firstMessage,
        voice_id: finalVoice?.id ?? voiceId ?? "jennifer",
        voice_provider: finalVoice?.provider ?? "11labs",
        language,
        inbound_enabled: callDirection === "inbound",
        outbound_enabled: callDirection === "outbound",
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Agent created", description: "Open the Test tab to talk to it." });
      navigate(`/app/agents/${data.id}`);
    } catch (err: any) {
      toast({ title: "Could not create agent", description: fmtErr(err), variant: "destructive" });
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
                  <h2 className="font-display text-2xl tracking-tight">Pick call direction</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose one direction for this agent.</p>
                  <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCallDirection("inbound")}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors sm:p-5",
                        callDirection === "inbound" ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:bg-surface",
                      )}
                    >
                      <div className="font-semibold">Inbound</div>
                      <div className="text-sm text-muted-foreground">Receive incoming calls</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCallDirection("outbound")}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors sm:p-5",
                        callDirection === "outbound" ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:bg-surface",
                      )}
                    >
                      <div className="font-semibold">Outbound</div>
                      <div className="text-sm text-muted-foreground">Place outgoing calls</div>
                    </button>
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card className="p-5 sm:p-8">
                  <h2 className="font-display text-2xl tracking-tight">Pick your industry</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We'll pre-tune the prompt and voice for your use case.</p>
                  <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
                    <button
                      disabled={!customIndustryFeatureReady}
                      onClick={() => setShowCustomIndustryForm((v) => !v)}
                      className={cn(
                        "group rounded-xl border border-dashed p-4 text-left transition-all sm:p-5",
                        showCustomIndustryForm ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:border-accent/50 hover:bg-surface",
                        !customIndustryFeatureReady && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></div>
                        <div>
                          <div className="font-semibold">Create Your Own Industry</div>
                          <div className="text-sm text-muted-foreground">Add a custom industry for this organisation.</div>
                        </div>
                      </div>
                    </button>
                    {!customIndustryFeatureReady && (
                      <p className="sm:col-span-2 text-sm text-muted-foreground">
                        Custom industries require the latest Supabase migration (`20260428170000_create_custom_industries.sql`).
                      </p>
                    )}
                    {showCustomIndustryForm && (
                      <Card className="sm:col-span-2 space-y-3 p-4">
                        <div className="space-y-1.5">
                          <Label>Industry name</Label>
                          <Input value={customIndustryName} onChange={(e) => setCustomIndustryName(e.target.value)} placeholder="e.g. Hexa Logistics" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Industry type</Label>
                          <select value={customIndustryType} onChange={(e) => setCustomIndustryType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                            {INDUSTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <Button onClick={upsertCustomIndustry} disabled={savingCustomIndustry}>
                          {savingCustomIndustry ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : editingCustomIndustryId ? "Update custom industry" : "Save custom industry"}
                        </Button>
                      </Card>
                    )}
                    {allIndustries.map((i) => (
                      <div key={i.id} className={cn(
                        "group rounded-xl border p-4 text-left transition-all sm:p-5",
                        industry === i.id ? "border-accent bg-accent-soft shadow-[var(--shadow-elev)]" : "border-border hover:border-accent/50 hover:bg-surface"
                      )}>
                        <button onClick={() => setIndustry(i.id)} className="w-full text-left">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><i.icon className="h-4 w-4" /></div>
                            <div>
                              <div className="font-semibold">{i.name}</div>
                              <div className="text-sm text-muted-foreground">{i.tagline}</div>
                            </div>
                          </div>
                        </button>
                        {i.id.startsWith("custom-") && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => startEditCustomIndustry(i.id.replace("custom-", ""))}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => deleteCustomIndustry(i.id.replace("custom-", ""))}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card className="p-5 sm:p-8">
                  <h2 className="font-display text-2xl tracking-tight">Describe your business</h2>
                  <p className="mt-1 text-sm text-muted-foreground">More detail = sharper agent. Country & tone are used to write a precise prompt.</p>
                  <div className="mt-5 sm:hidden">
                    <div className="mb-4 grid grid-cols-2 gap-2">
                      <Button variant={describeStep === "details" ? "default" : "outline"} onClick={() => setDescribeStep("details")}>Business</Button>
                      <Button variant={describeStep === "prompt" ? "default" : "outline"} onClick={() => setDescribeStep("prompt")}>Prompt</Button>
                    </div>
                    {describeStep === "details" ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Business name</Label>
                          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Bluebird Dental" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Agent name</Label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${ind?.name} Receptionist`} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Top use cases</Label>
                          <Input value={useCases} onChange={(e) => setUseCases(e.target.value)} placeholder="Book appointments, answer pricing, qualify leads" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Business description</Label>
                          <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`We run a ${ind?.name.toLowerCase()} business. Hours, services, what callers usually ask…`} />
                        </div>
                        <Button className="w-full" variant="outline" onClick={() => setDescribeStep("prompt")}>Continue to prompt</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Tone</Label>
                          <div className="flex flex-wrap gap-2">
                            {TONES.map((t) => (
                              <button key={t} onClick={() => setTone(t)} type="button" className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", tone === t ? "border-accent bg-accent-soft" : "border-border hover:bg-surface")}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button onClick={generate} disabled={generating || !description} variant="outline" className="w-full">
                          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate prompt with AI</>}
                        </Button>
                        <div className="space-y-1.5">
                          <Label>First message</Label>
                          <Textarea rows={2} value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>System prompt</Label>
                          <Textarea rows={10} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 hidden sm:grid sm:grid-cols-2 sm:gap-4">
                    <Card className="space-y-4 p-4">
                      <div className="space-y-1.5">
                        <Label>Business name</Label>
                        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Bluebird Dental" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Agent name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${ind?.name} Receptionist`} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Top use cases</Label>
                        <Input value={useCases} onChange={(e) => setUseCases(e.target.value)} placeholder="Book appointments, answer pricing, qualify leads" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Business description</Label>
                        <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`We run a ${ind?.name.toLowerCase()} business. Hours, services, what callers usually ask…`} />
                      </div>
                    </Card>
                    <Card className="space-y-4 p-4">
                      <div className="space-y-1.5">
                        <Label>Tone</Label>
                        <div className="flex flex-wrap gap-2">
                          {TONES.map((t) => (
                            <button key={t} onClick={() => setTone(t)} type="button" className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", tone === t ? "border-accent bg-accent-soft" : "border-border hover:bg-surface")}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button onClick={generate} disabled={generating || !description} variant="outline" className="w-full">
                        {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate prompt with AI</>}
                      </Button>
                      <div className="space-y-1.5">
                        <Label>First message</Label>
                        <Textarea rows={2} value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>System prompt</Label>
                        <Textarea rows={10} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
                      </div>
                    </Card>
                  </div>
                </Card>
              )}

              {step === 3 && (
                <Card className="p-5 sm:p-8 space-y-6">
                  <div>
                    <h2 className="font-display text-2xl tracking-tight">Voice & language</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Filtered by your accent, gender and language. Click ▶ to preview.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Country / market</Label>
                      <select value={country} onChange={(e) => setCountry(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Accent / dialect</Label>
                      <select value={accent} onChange={(e) => setAccent(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Voice gender</Label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">Language</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {languages.map((l) => (
                        <button key={l.id} onClick={() => setLanguage(l.id)} className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                          language === l.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                        )}>{l.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <Label>Character voice</Label>
                      <span className="text-xs text-muted-foreground">{visibleVoices.length} match{visibleVoices.length === 1 ? "" : "es"}</span>
                    </div>
                    <div className="mb-3">
                      <Input
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                        placeholder="Search voices by name, accent, gender..."
                      />
                    </div>
                    {!strictFilteredVoices.length && !!languageOnlyVoices.length && (
                      <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                        No exact accent/gender match found. Showing language-matched voices.
                      </div>
                    )}
                    {catalog?.warning && (
                      <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                        {catalog.warning}
                      </div>
                    )}
                    {visibleVoices.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        No voices found for current filters/search. Try changing country, accent, gender, or search text.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 max-h-[420px] overflow-y-auto pr-1">
                        {visibleVoices.map((v) => (
                        <div key={`${v.provider}-${v.id}`} className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                          (selectedVoice?.id ?? voiceId) === v.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                        )}>
                          <button onClick={() => setVoiceId(v.id)} className="flex-1 text-left">
                            <div className="font-medium text-sm">{v.label}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{v.description}</div>
                            {(v.gender || v.accent) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {v.gender && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{v.gender}</span>}
                                {v.accent && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{v.accent}</span>}
                              </div>
                            )}
                          </button>
                          <button
                            onClick={() => playPreview(v)}
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-primary-foreground hover:opacity-90",
                              v.previewUrl ? "bg-primary" : "bg-muted",
                            )}
                            aria-label={previewing === v.id ? "Pause preview" : "Play preview"}
                          >
                            {previewing === v.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {step === 4 && (
                <Card className="p-5 sm:p-8 space-y-5">
                  <h2 className="font-display text-2xl tracking-tight">Review & create</h2>
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {[
                      ["Name", name],
                      ["Business", businessName],
                      ["Industry", ind?.name],
                      ["Direction", callDirection === "inbound" ? "Inbound" : "Outbound"],
                      ["Country", COUNTRIES.find((c) => c.id === country)?.label],
                      ["Accent", accent],
                      ["Tone", tone],
                      ["Voice", selectedVoice?.label],
                      ["Language", languages.find((l) => l.id === language)?.label],
                      ["First message", firstMessage],
                    ].filter(([, v]) => v).map(([k, v]) => (
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
              <Button onClick={next} disabled={(step === 1 && !industry) || (step === 2 && !systemPrompt)}>Continue <ArrowRight className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default NewAgent;
