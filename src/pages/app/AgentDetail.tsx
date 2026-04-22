import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, Phone, Loader2, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VOICES, LANGUAGES, INDUSTRIES } from "@/lib/industries";
import Vapi from "@vapi-ai/web";
import { cn } from "@/lib/utils";

type Agent = any;
type Turn = { role: "user" | "assistant"; text: string };

// Extract a human-readable message from Vapi's error payloads (often nested objects)
const fmtErr = (e: any): string => {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.message && typeof e.message === "string") return e.message;
  if (e.error?.message) return e.error.message;
  if (e.errorMsg) return e.errorMsg;
  if (e.error && typeof e.error === "string") return e.error;
  if (Array.isArray(e?.error?.message)) return e.error.message.join(", ");
  try { return JSON.stringify(e); } catch { return String(e); }
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

const AgentDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const vapiRef = useRef<Vapi | null>(null);

  const [destNumber, setDestNumber] = useState("");
  const [placing, setPlacing] = useState(false);

  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase.from("agents").select("*").eq("id", id).single().then(({ data }) => setAgent(data));
    supabase.from("calls").select("*").eq("agent_id", id).order("created_at", { ascending: false }).then(({ data }) => setCalls(data ?? []));
  }, [id]);

  const save = async () => {
    if (!agent) return;
    setSaving(true);
    const { error } = await supabase.from("agents").update({
      name: agent.name, system_prompt: agent.system_prompt, first_message: agent.first_message,
      voice_id: agent.voice_id, language: agent.language,
    }).eq("id", agent.id);
    setSaving(false);
    toast({ title: error ? "Save failed" : "Saved", description: error?.message, variant: error ? "destructive" : undefined });
  };

  const startCall = async () => {
    if (!agent) return;
    setCallStatus("connecting");
    setTranscript([]);
    try {
      // Ask for mic permission up front for a smoother first-time experience
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { throw new Error("Microphone permission denied. Allow mic access and try again."); }

      const { data, error } = await supabase.functions.invoke("vapi-web-token");
      if (error) throw error;
      if (!data?.publicKey) throw new Error(data?.error || "Voice service not configured.");

      const vapi = new Vapi(data.publicKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setCallStatus("active"));
      vapi.on("call-end", () => { setCallStatus("ended"); setVolume(0); });
      vapi.on("volume-level", (v: number) => setVolume(v));
      vapi.on("message", (m: any) => {
        if (m.type === "transcript" && m.transcriptType === "final") {
          setTranscript((t) => [...t, { role: m.role === "user" ? "user" : "assistant", text: m.transcript }]);
        }
      });
      vapi.on("error", (e: any) => {
        const msg = fmtErr(e);
        console.error("Vapi error:", e);
        toast({ title: "Call error", description: msg, variant: "destructive" });
        setCallStatus("idle");
      });

      const voiceId = VOICE_MAP[agent.voice_id] ?? agent.voice_id;
      await vapi.start({
        name: agent.name,
        firstMessage: agent.first_message,
        model: { provider: "openai", model: agent.model || "gpt-4o-mini", temperature: Number(agent.temperature ?? 0.7),
          messages: [{ role: "system", content: agent.system_prompt }] },
        voice: { provider: "11labs", voiceId },
        transcriber: { provider: "deepgram", model: "nova-2", language: (agent.language || "en-US").slice(0, 2) },
      });
    } catch (e: any) {
      console.error("startCall failed:", e);
      toast({ title: "Could not start call", description: fmtErr(e), variant: "destructive" });
      setCallStatus("idle");
    }
  };

  const endCall = () => { vapiRef.current?.stop(); };

  const placeCall = async () => {
    if (!destNumber) return;
    setPlacing(true);
    try {
      const { data, error } = await supabase.functions.invoke("vapi-place-call", {
        body: { agentId: agent.id, toNumber: destNumber },
      });
      if (error) throw error;
      toast({ title: "Call queued", description: `Calling ${destNumber}…` });
      setDestNumber("");
    } catch (e: any) {
      toast({ title: "Could not place call", description: e.message, variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  if (!agent) return <div className="grid h-[60vh] place-items-center text-muted-foreground">Loading…</div>;

  const ind = INDUSTRIES.find((i) => i.id === agent.industry);

  return (
    <>
      <PageHeader
        title={agent.name}
        description={ind?.name}
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
                <VoiceOrb active={callStatus === "active"} volume={volume} size={240} className="sm:hidden" />
                <VoiceOrb active={callStatus === "active"} volume={volume} size={300} className="hidden sm:block" />
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
                    <Button size="lg" variant="destructive" onClick={endCall}><MicOff className="h-4 w-4" /> End call</Button>
                  ) : (
                    <Button size="lg" onClick={startCall}><Mic className="h-4 w-4" /> Start call</Button>
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
              <div className="space-y-1.5">
                <Label>First message</Label>
                <Textarea rows={2} value={agent.first_message} onChange={(e) => setAgent({ ...agent, first_message: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>System prompt</Label>
                <Textarea rows={10} value={agent.system_prompt} onChange={(e) => setAgent({ ...agent, system_prompt: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Character voice</Label>
                  <select value={agent.voice_id} onChange={(e) => setAgent({ ...agent, voice_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label} — {v.description}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <select value={agent.language || "en-US"} onChange={(e) => setAgent({ ...agent, language: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes</Button>
            </Card>
          </TabsContent>

          <TabsContent value="phone" className="mt-6">
            <Card className="p-5 sm:p-8">
              <h3 className="font-semibold">Place an outbound call</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your agent will call this number from one of your attached phone numbers.</p>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <Label>Destination phone (E.164)</Label>
                  <Input placeholder="+15551234567" value={destNumber} onChange={(e) => setDestNumber(e.target.value)} />
                </div>
                <Button onClick={placeCall} disabled={placing || !destNumber} className="w-full sm:w-auto">
                  {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Place call
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Note: requires a phone number attached in <Link to="/app/phone-numbers" className="text-accent hover:underline">Phone numbers</Link>.</p>
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
    </>
  );
};

export default AgentDetail;
