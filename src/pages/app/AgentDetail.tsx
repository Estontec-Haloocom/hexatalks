import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, Phone, Loader2, PlayCircle, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { VoiceOrb } from "@/components/VoiceOrb";
import { INDUSTRIES } from "@/lib/industries";
import { useVoiceCatalog, type VoiceOption } from "@/hooks/use-voice-catalog";
import { cn } from "@/lib/utils";
import { startWebCall, type CallController } from "@/lib/voice-call";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { usePromptBlocks } from "@/hooks/use-prompt-blocks";
import { useOrgPromptConfig } from "@/hooks/use-org-prompt-config";

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
  { id: "AE", label: "🇦🇪 UAE" },
  { id: "SA", label: "🇸🇦 Saudi Arabia" },
];

const COUNTRY_ACCENT_MAP: Record<string, string[]> = {
  US: ["American", "Neutral"],
  GB: ["British", "Scottish", "Neutral"],
  IN: ["Indian", "Neutral"],
  AU: ["Australian", "Neutral"],
  CA: ["Canadian", "Neutral"],
  IE: ["Irish", "Neutral"],
  ZA: ["South African", "Neutral"],
  DE: ["German", "Neutral"],
  FR: ["French", "Neutral"],
  ES: ["Spanish", "Neutral"],
  BR: ["Brazilian", "Neutral"],
  MX: ["Mexican", "Neutral"],
  AE: ["Arabic", "Middle Eastern", "Neutral"],
  SA: ["Arabic", "Middle Eastern", "Neutral"],
};

const GENDERS = ["Female", "Male", "Neutral"];

const wordIncludes = (haystack: string | undefined, needle: string) => {
  if (!haystack) return false;
  try {
    return new RegExp(`\\b${needle}\\b`, 'i').test(haystack);
  } catch {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }
};

type Agent = any;
type Turn = { role: "user" | "assistant"; text: string };

// Extract a human-readable message from Vapi's error payloads (often nested objects)
const fmtErr = (e: any): string => {
  const toText = (value: any): string | null => {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
      const items = value.map(toText).filter(Boolean);
      return items.length ? items.join(", ") : null;
    }
    if (typeof value === "object") {
      return toText(value.message) ?? toText(value.error) ?? toText(value.errorMsg) ?? (() => {
        try { return JSON.stringify(value); } catch { return String(value); }
      })();
    }
    return String(value);
  };

  return toText(e) ?? "Unknown error";
};

// Friendly character names → ElevenLabs voice IDs
const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

// Helper for delimited multi-language prompts
const parseDelimited = (text: string | null | undefined, defaultLang: string) => {
  if (!text) return { [defaultLang]: "" };
  if (!text.includes("===LANG:")) {
    return { [defaultLang]: text };
  }
  const result: Record<string, string> = {};
  const parts = text.split(/===LANG:([a-zA-Z0-9-]+)===/);
  for (let i = 1; i < parts.length; i += 2) {
    result[parts[i]] = parts[i+1].trim();
  }
  return result;
};

const serializeDelimited = (obj: Record<string, string>) => {
  const keys = Object.keys(obj);
  if (keys.length === 1) return obj[keys[0]];
  return keys.map((lang) => `===LANG:${lang}===\n${obj[lang]}`).join("\n\n");
};

const AgentDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [customIndustry, setCustomIndustry] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [translationPromptOpen, setTranslationPromptOpen] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<{ id: string, label: string, newLangs: string[] } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const callRef = useRef<CallController | null>(null);

  const [destNumber, setDestNumber] = useState("");
  const [placing, setPlacing] = useState(false);

  const [calls, setCalls] = useState<any[]>([]);
  const { data: catalog } = useVoiceCatalog();
  const { settings: devSettings } = useDevSettings();
  const { blocks } = usePromptBlocks();
  const { config: orgPromptConfig } = useOrgPromptConfig();

  // Voice filtering states
  const [country, setCountry] = useState("US");
  const availableAccents = COUNTRY_ACCENT_MAP[country] || ["Neutral"];
  const [accent, setAccent] = useState(availableAccents[0]);
  const [gender, setGender] = useState("Neutral");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [activeLangTab, setActiveLangTab] = useState<string>("");

  useEffect(() => {
    if (!availableAccents.includes(accent)) {
      setAccent(availableAccents[0]);
    }
  }, [country, availableAccents, accent]);

  useEffect(() => {
    if (agent && !activeLangTab) {
      const langs = agent.language?.split(",") || ["en-US"];
      setActiveLangTab(langs[0]);
    }
  }, [agent, activeLangTab]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

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
    if (!id) return;
    supabase.from("agents").select("*").eq("id", id).single().then(async ({ data }) => {
      setAgent(data);
      if (data?.industry?.startsWith("custom-")) {
        const ciId = data.industry.replace("custom-", "");
        const { data: ci } = await supabase.from("custom_industries" as any).select("name").eq("id", ciId).single();
        setCustomIndustry(ci);
      }
    });
    supabase.from("calls").select("*").eq("agent_id", id).order("created_at", { ascending: false }).then(({ data }) => setCalls(data ?? []));
  }, [id]);

  const reloadCalls = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });
    setCalls(data ?? []);
  };

  const handleLanguageSelect = (langId: string, langLabel: string) => {
    const currentLangs = agent?.language ? agent.language.split(",") : [];
    const isSelected = currentLangs.includes(langId);

    if (isSelected && currentLangs.length === 1) return;

    if (isSelected) {
      const newLangs = currentLangs.filter((l: string) => l !== langId);
      setAgent({ ...agent, language: newLangs.join(",") });
    } else {
      const newLangs = [...currentLangs, langId];
      setPendingLanguage({ id: langId, label: langLabel, newLangs });
      setTranslationPromptOpen(true);
    }
  };

  const confirmTranslation = async (shouldTranslate: boolean) => {
    if (!pendingLanguage || !agent) {
      setTranslationPromptOpen(false);
      return;
    }

    const { newLangs } = pendingLanguage;
    const newLangsLabels = newLangs.map((id: string) => languages.find((l) => l.id === id)?.label || id);
    const newLangStr = newLangs.join(",");
    const primaryLang = newLangs[0];

    if (!shouldTranslate) {
      setAgent({ ...agent, language: newLangStr });
      setTranslationPromptOpen(false);
      setPendingLanguage(null);
      setActiveLangTab(pendingLanguage.id);
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-agent-config", {
        body: {
          action: "translate_single",
          system_prompt: parseDelimited(agent.system_prompt, primaryLang)[primaryLang] || " ",
          first_message: parseDelimited(agent.first_message, primaryLang)[primaryLang] || " ",
          target_language: pendingLanguage.label,
        }
      });

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("Translation returned error:", data.error, data.details);
        throw new Error(data.error);
      }

      const currentSys = parseDelimited(agent.system_prompt, primaryLang);
      const currentFirst = parseDelimited(agent.first_message, primaryLang);
      
      currentSys[pendingLanguage.id] = data.system_prompt;
      currentFirst[pendingLanguage.id] = data.first_message;

      setAgent({
        ...agent,
        language: newLangStr,
        system_prompt: serializeDelimited(currentSys),
        first_message: serializeDelimited(currentFirst),
      });
      setActiveLangTab(pendingLanguage.id);
      toast({ title: "Translated successfully", description: `Your prompt has been translated for ${pendingLanguage.label}.` });
    } catch (err: any) {
      console.error("Translation failed:", err);
      toast({ title: "Translation failed", description: err.message || "Could not translate prompt.", variant: "destructive" });
      // Still update language if translation fails
      setAgent({ ...agent, language: newLangStr });
    } finally {
      setIsTranslating(false);
      setTranslationPromptOpen(false);
      setPendingLanguage(null);
    }
  };

  const handlePromptChange = (field: "system_prompt" | "first_message", value: string) => {
    const currentLangs = agent.language?.split(",") || ["en-US"];
    const primaryLang = currentLangs[0];
    const parsed = parseDelimited(agent[field], primaryLang);
    parsed[activeLangTab || primaryLang] = value;
    setAgent({ ...agent, [field]: serializeDelimited(parsed) });
  };

  const save = async () => {
    if (!agent) return;
    setSaving(true);
    const selectedVoice = (catalog?.voices ?? []).find((voice) => voice.id === agent.voice_id);
    const { error } = await supabase.from("agents").update({
      name: agent.name, system_prompt: agent.system_prompt, first_message: agent.first_message,
      voice_id: agent.voice_id, voice_provider: selectedVoice?.provider ?? agent.voice_provider ?? "11labs", language: agent.language,
    }).eq("id", agent.id);
    setSaving(false);
    toast({ title: error ? "Save failed" : "Saved", description: error ? fmtErr(error) : undefined, variant: error ? "destructive" : undefined });
  };

  const startCall = async () => {
    if (!agent) return;
    setCallStatus("connecting");
    setTranscript([]);
    try {
      const ctrl = startWebCall(devSettings.voice_platform, agent, blocks, { orgPromptConfig, devSettings });
      callRef.current = ctrl;
      ctrl.on("status", (s) => setCallStatus(s));
      ctrl.on("volume", (v) => setVolume(v));
      ctrl.on("transcript", (t) => setTranscript((prev) => [...prev, t]));
      ctrl.on("error", (e) => {
        toast({ title: "Call error", description: fmtErr(e), variant: "destructive" });
        setCallStatus("idle");
      });
    } catch (e: any) {
      console.error("startCall failed:", e);
      toast({ title: "Could not start call", description: fmtErr(e), variant: "destructive" });
      setCallStatus("idle");
    }
  };

  const endCall = () => { callRef.current?.stop(); };

  const providerLabel = devSettings.telephony_provider === "plivo" ? "Plivo" : devSettings.telephony_provider === "exotel" ? "Exotel" : "Twilio";

  const placeCall = async () => {
    if (!destNumber) return;
    // Normalize: strip formatting, convert leading 00 to +, ensure leading +
    let to = destNumber.trim().replace(/[\s\-().]/g, "");
    if (to.startsWith("00")) to = "+" + to.slice(2);
    if (!to.startsWith("+")) to = "+" + to.replace(/^\+?/, "");
    if (!/^\+\d{8,15}$/.test(to)) {
      toast({ title: "Invalid number", description: "Enter the country code and mobile number, e.g. +919876543210", variant: "destructive" });
      return;
    }
    // Telephony provider rejects premium / special prefixes by default
    const premium = /^\+1(900|976|809|411|700|500|976)/;
    if (premium.test(to)) {
      toast({
        title: "Premium number blocked",
        description: `Numbers starting with +1 900/976/809/411 are premium and not allowed by ${providerLabel}. Try a regular mobile or landline.`,
        variant: "destructive",
      });
      return;
    }
    setPlacing(true);
    try {
      // Unified outbound runtime: same agent config + platform logic as test mode,
      // while still dialing through the active telephony provider from server-side secrets.
      const { data, error } = await supabase.functions.invoke("vapi-place-call", {
        body: { agentId: agent.id, toNumber: to },
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || "Could not place call");
      toast({ title: "Call queued", description: `Calling ${to}…` });
      setDestNumber("");
      await reloadCalls();
      if (data?.vapiCallId) {
        // Sync status/transcript in the background so call history is updated.
        setTimeout(async () => {
          await supabase.functions.invoke("vapi-sync-call", { body: { callId: data.vapiCallId } });
          await reloadCalls();
        }, 15000);
      }
    } catch (e: any) {
      console.error("placeCall failed:", e);
      toast({ title: "Could not place call", description: fmtErr(e), variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  const voices = catalog?.voices ?? [];
  const languages = catalog?.languages ?? [];

  const baseVoices = useMemo(() => {
    if (!agent?.language) return voices;
    const currentLangs = agent.language.split(",");
    const primaryLang = currentLangs[0]?.toLowerCase() || "";

    return voices.filter((v) => {
      const vLang = (v.language || "").toLowerCase();
      const langOk = !vLang || !primaryLang ||
        vLang === primaryLang || 
        vLang === primaryLang.slice(0, 2) || 
        primaryLang === vLang.slice(0, 2);

      const isNeutralGender = gender === "Neutral";
      const matchesGender = wordIncludes(v.gender, gender) || wordIncludes(v.description, gender) || wordIncludes(v.label, gender);
      const genderOk = isNeutralGender || matchesGender;

      const isNeutralAccent = accent === "Neutral";
      const matchesAccent = wordIncludes(v.accent, accent) || wordIncludes(v.country, accent) || wordIncludes(v.description, accent) || wordIncludes(v.label, accent);
      const accentOk = isNeutralAccent || matchesAccent;

      return langOk && genderOk && accentOk;
    });
  }, [voices, agent?.language, gender, accent]);
  const visibleVoices = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase();
    if (!q) return baseVoices;
    return baseVoices.filter((v) =>
      `${v.label} ${v.description} ${v.id} ${v.accent ?? ""} ${v.gender ?? ""} ${v.country ?? ""}`.toLowerCase().includes(q),
    );
  }, [baseVoices, voiceSearch]);

  const selectedVoice: VoiceOption | undefined =
    visibleVoices.find((v) => v.id === agent?.voice_id) ?? visibleVoices[0];

  if (!agent) return <div className="grid h-[60vh] place-items-center text-muted-foreground">Loading…</div>;

  const ind = INDUSTRIES.find((i) => i.id === agent.industry);
  const industryName = ind?.name || customIndustry?.name || agent.industry;
  const currentLangs = agent.language?.split(",") || ["en-US"];
  const primaryLang = currentLangs[0];
  const activeSystemPrompt = parseDelimited(agent.system_prompt, primaryLang)[activeLangTab || primaryLang] || "";
  const activeFirstMessage = parseDelimited(agent.first_message, primaryLang)[activeLangTab || primaryLang] || "";

  return (
    <>
      <PageHeader
        title={agent.name}
        description={industryName}
        actions={<Button asChild variant="ghost" size="sm"><Link to="/app/agents"><ArrowLeft className="h-4 w-4" /> All agents</Link></Button>}
      />
      <div className="px-5 py-6 sm:p-8">
        <Tabs defaultValue="test">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="test" className="flex-1 sm:flex-initial">Test</TabsTrigger>
            <TabsTrigger value="configure" className="flex-1 sm:flex-initial">Configure</TabsTrigger>
            <TabsTrigger value="phone" className="flex-1 sm:flex-initial">Phone</TabsTrigger>
            <TabsTrigger value="calls" className="flex-1 sm:flex-initial">Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card className="grid place-items-center p-6 sm:p-10">
                <VoiceOrb 
                  status={callStatus} 
                  volume={volume} 
                  isSpeaking={callStatus === "active" && volume > 0.05}
                  size={240} 
                  className="sm:hidden" 
                />
                <VoiceOrb 
                  status={callStatus} 
                  volume={volume} 
                  isSpeaking={callStatus === "active" && volume > 0.05}
                  size={300} 
                  className="hidden sm:block" 
                />
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
                  <span className={cn("h-1.5 w-1.5 rounded-full",
                    callStatus === "active" ? "bg-success animate-pulse" :
                    callStatus === "connecting" ? "bg-warning animate-pulse" : "bg-muted-foreground"
                  )} />
                  {callStatus === "idle" && "Ready"}
                  {callStatus === "connecting" && "Connecting…"}
                  {callStatus === "active" && (volume > 0.05 ? "Listening" : "Speaking")}
                  {callStatus === "ended" && "Call ended"}
                </div>
                <div className="mt-7">
                  {callStatus === "active" || callStatus === "connecting" ? (
                    <Button size="lg" variant="destructive" onClick={endCall} className="rounded-full px-8 shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95">
                      <MicOff className="mr-2 h-4 w-4" /> End call
                    </Button>
                  ) : (
                    <Button size="lg" onClick={startCall} className="rounded-full px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                      <Mic className="mr-2 h-4 w-4" /> Start call
                    </Button>
                  )}
                </div>
              </Card>
              <Card className="flex h-[420px] flex-col p-0 lg:h-[500px]">
                <div className="border-b border-border px-5 py-3 text-sm font-medium">Live transcript</div>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {transcript.length === 0 && <div className="text-sm text-muted-foreground">Start the call to see the transcript here.</div>}
                  {transcript.map((t, i) => (
                    <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      t.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "bg-secondary"
                    )}>{t.text}</div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="configure" className="mt-6">
            <Card className="space-y-5 p-5 sm:p-8">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} />
              </div>

              {currentLangs.length > 1 && (
                <div className="flex flex-wrap gap-2 border-b border-border pb-4">
                  {currentLangs.map((l) => (
                    <button
                      key={l}
                      onClick={() => setActiveLangTab(l)}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                        activeLangTab === l ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      )}
                    >
                      {languages.find(lg => lg.id === l)?.label || l}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>First message {currentLangs.length > 1 && <span className="text-xs text-muted-foreground">({languages.find(lg => lg.id === activeLangTab)?.label || activeLangTab})</span>}</Label>
                <Textarea rows={2} value={activeFirstMessage} onChange={(e) => handlePromptChange("first_message", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>System prompt {currentLangs.length > 1 && <span className="text-xs text-muted-foreground">({languages.find(lg => lg.id === activeLangTab)?.label || activeLangTab})</span>}</Label>
                <Textarea rows={10} value={activeSystemPrompt} onChange={(e) => handlePromptChange("system_prompt", e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Voice & language</h3>
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
                        {availableAccents.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Voice gender</Label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Language (Select multiple if needed)</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {languages.map((l) => {
                      const isSelected = (agent.language || "").split(",").includes(l.id);
                      return (
                        <button 
                          key={l.id} 
                          onClick={() => handleLanguageSelect(l.id, l.label)} 
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-all",
                            isSelected ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                          )}
                        >
                          {l.label}
                        </button>
                      );
                    })}
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
                        (selectedVoice?.id ?? agent.voice_id) === v.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                      )}>
                        <button onClick={() => setAgent({ ...agent, voice_id: v.id, voice_provider: v.provider })} className="flex-1 text-left">
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
              </div>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes</Button>
            </Card>
          </TabsContent>

          <TabsContent value="phone" className="mt-6">
            <Card className="p-5 sm:p-8">
              <h3 className="font-semibold">Place an outbound call</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your agent will call this number from +14234608558.</p>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <Label>Destination phone with country code</Label>
                  <Input placeholder="+919876543210" value={destNumber} onChange={(e) => setDestNumber(e.target.value)} />
                </div>
                <Button onClick={placeCall} disabled={placing || !destNumber} className="w-full sm:w-auto">
                  {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Place call
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Outbound calls use the default caller ID +14234608558.</p>
            </Card>
          </TabsContent>

          <TabsContent value="calls" className="mt-6">
            <Card className="p-0">
              {calls.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No calls yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {calls.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <PlayCircle className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{c.to_number || "Web test"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{c.duration_sec ?? 0}s</div>
                      <div className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={translationPromptOpen} onOpenChange={(open) => !isTranslating && setTranslationPromptOpen(open)}>
        <DialogContent className="w-[90vw] max-w-sm rounded-2xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg">Translate Prompt?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">
              You've selected <strong>{pendingLanguage?.label}</strong>. Would you like to use AI to translate your existing First Message and System Prompt into this language?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => confirmTranslation(false)} disabled={isTranslating} className="w-full sm:w-auto">
              No, keep current text
            </Button>
            <Button onClick={() => confirmTranslation(true)} disabled={isTranslating} className="w-full sm:w-auto">
              {isTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, translate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgentDetail;
