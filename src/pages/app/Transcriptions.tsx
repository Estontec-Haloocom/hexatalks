import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, Smile, Frown, Meh, PlayCircle, Phone, Clock, TrendingUp, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { useOrg } from "@/contexts/OrgContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Call = {
  id: string;
  agent_id: string | null;
  vapi_call_id: string | null;
  to_number: string | null;
  from_number: string | null;
  direction: string;
  status: string;
  duration_sec: number | null;
  cost_usd: number | null;
  recording_url: string | null;
  transcript: any;
  created_at: string;
};

const POSITIVE = ["thank", "great", "perfect", "awesome", "love", "happy", "good", "yes", "appreciate", "excellent", "wonderful", "helpful"];
const NEGATIVE = ["bad", "angry", "upset", "hate", "wrong", "terrible", "no ", "not ", "frustrated", "complain", "refund", "cancel", "issue", "problem"];

const scoreSentiment = (text: string): { label: "positive" | "neutral" | "negative"; score: number } => {
  if (!text) return { label: "neutral", score: 0 };
  const t = text.toLowerCase();
  let pos = 0, neg = 0;
  POSITIVE.forEach((w) => { if (t.includes(w)) pos++; });
  NEGATIVE.forEach((w) => { if (t.includes(w)) neg++; });
  const score = pos - neg;
  if (score > 1) return { label: "positive", score };
  if (score < -1) return { label: "negative", score };
  return { label: "neutral", score };
};

const transcriptToText = (transcript: any): string => {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript.map((t: any) => `${t.role || "?"}: ${t.text || t.message || ""}`).join("\n");
  }
  if (typeof transcript === "object") {
    if (transcript.text) return transcript.text;
    if (Array.isArray(transcript.messages)) {
      return transcript.messages.map((m: any) => `${m.role || "?"}: ${m.message || m.text || ""}`).join("\n");
    }
  }
  return "";
};

const fmtDur = (s: number | null) => {
  const sec = s ?? 0;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

const Transcriptions = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Call | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const { currentOrgId } = useOrg();

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (!currentOrgId) { setCalls([]); setAgents({}); setLoading(false); return; }
      const [{ data: callsData }, { data: agentsData }] = await Promise.all([
        supabase.from("calls").select("*").eq("org_id", currentOrgId).order("created_at", { ascending: false }),
        supabase.from("agents").select("id, name").eq("org_id", currentOrgId),
      ]);
      setCalls((callsData as Call[]) ?? []);
      const map: Record<string, string> = {};
      (agentsData ?? []).forEach((a: any) => { map[a.id] = a.name; });
      setAgents(map);
      if (callsData && callsData.length) setSelected(callsData[0] as Call);
      setLoading(false);
    })();
  }, [currentOrgId]);

  const enriched = useMemo(() => {
    return calls.map((c) => {
      const text = transcriptToText(c.transcript);
      const sentiment = scoreSentiment(text);
      return { ...c, _text: text, _sentiment: sentiment };
    });
  }, [calls]);

  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      if (filter !== "all" && c._sentiment.label !== filter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        c.to_number?.toLowerCase().includes(q) ||
        c.from_number?.toLowerCase().includes(q) ||
        c._text.toLowerCase().includes(q) ||
        (c.agent_id && agents[c.agent_id]?.toLowerCase().includes(q))
      );
    });
  }, [enriched, filter, query, agents]);

  // Dashboard stats
  const stats = useMemo(() => {
    const total = enriched.length;
    const totalSec = enriched.reduce((sum, c) => sum + (c.duration_sec ?? 0), 0);
    const avgSec = total ? Math.round(totalSec / total) : 0;
    const cost = enriched.reduce((sum, c) => sum + Number(c.cost_usd ?? 0), 0);
    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    enriched.forEach((c) => sentiments[c._sentiment.label]++);
    const completed = enriched.filter((c) => c.status === "ended" || c.status === "completed").length;
    return { total, avgSec, totalSec, cost, sentiments, completed };
  }, [enriched]);

  const downloadRecording = (c: Call) => {
    if (!c.recording_url) return;
    const a = document.createElement("a");
    a.href = c.recording_url;
    a.download = `call-${c.id}.mp3`;
    a.target = "_blank";
    a.click();
  };

  const downloadTranscript = (c: Call & { _text?: string }) => {
    const text = c._text || transcriptToText(c.transcript);
    const blob = new Blob([text || "(empty transcript)"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${c.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SentimentIcon = ({ label }: { label: "positive" | "neutral" | "negative" }) => {
    if (label === "positive") return <Smile className="h-4 w-4 text-success" />;
    if (label === "negative") return <Frown className="h-4 w-4 text-destructive" />;
    return <Meh className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <>
      <PageHeader title="Transcriptions" description="Recordings, live transcripts, and sentiment analysis across all your calls." />
      <div className="px-5 py-6 sm:p-8 space-y-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="library">Recordings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Total calls</div>
                <div className="mt-2 font-display text-3xl">{stats.total}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stats.completed} completed</div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Avg duration</div>
                <div className="mt-2 font-display text-3xl">{fmtDur(stats.avgSec)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDur(stats.totalSec)} total</div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Spend</div>
                <div className="mt-2 font-display text-3xl">${stats.cost.toFixed(2)}</div>
                <div className="mt-1 text-xs text-muted-foreground">across all calls</div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Sentiment</div>
                <div className="mt-2 flex items-end gap-3 text-sm">
                  <span className="flex items-center gap-1 text-success"><Smile className="h-4 w-4" />{stats.sentiments.positive}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Meh className="h-4 w-4" />{stats.sentiments.neutral}</span>
                  <span className="flex items-center gap-1 text-destructive"><Frown className="h-4 w-4" />{stats.sentiments.negative}</span>
                </div>
                <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  {stats.total > 0 && <>
                    <div className="bg-success" style={{ width: `${(stats.sentiments.positive / stats.total) * 100}%` }} />
                    <div className="bg-muted-foreground/40" style={{ width: `${(stats.sentiments.neutral / stats.total) * 100}%` }} />
                    <div className="bg-destructive" style={{ width: `${(stats.sentiments.negative / stats.total) * 100}%` }} />
                  </>}
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="font-semibold">Recent activity</h3>
              <div className="mt-3 divide-y divide-border">
                {enriched.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <SentimentIcon label={c._sentiment.label} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.to_number || c.from_number || "Web test"}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.agent_id ? agents[c.agent_id] || "Agent" : "—"} • {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDur(c.duration_sec)}</div>
                  </div>
                ))}
                {enriched.length === 0 && !loading && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No calls yet. Start a test call from any agent.</div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="library" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <Card className="flex h-[70vh] flex-col p-0">
                <div className="space-y-2 border-b border-border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search number, agent, transcript…" className="pl-8" />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "positive", "neutral", "negative"] as const).map((f) => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={cn("flex-1 rounded-md px-2 py-1 text-[11px] capitalize transition-colors",
                          filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
                  {!loading && filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">No calls match.</div>
                  )}
                  {filtered.map((c) => (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className={cn("flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left text-sm transition-colors hover:bg-surface",
                        selected?.id === c.id && "bg-accent-soft")}>
                      <SentimentIcon label={c._sentiment.label} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{c.to_number || c.from_number || "Web test"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.agent_id ? agents[c.agent_id] || "Agent" : "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{fmtDur(c.duration_sec)}</span>
                          <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5">{c.status}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="flex h-[70vh] flex-col p-0">
                {selected ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{selected.to_number || selected.from_number || "Web test"}</div>
                        <div className="text-xs text-muted-foreground">
                          {selected.agent_id ? (
                            <Link to={`/app/agents/${selected.agent_id}`} className="hover:underline">
                              {agents[selected.agent_id] || "Agent"}
                            </Link>
                          ) : "—"} • {new Date(selected.created_at).toLocaleString()} • {fmtDur(selected.duration_sec)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                        <SentimentIcon label={scoreSentiment(transcriptToText(selected.transcript)).label} />
                        <span className="capitalize">{scoreSentiment(transcriptToText(selected.transcript)).label}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadTranscript(selected as any)}>
                          <Download className="h-3.5 w-3.5" /> Transcript
                        </Button>
                        {selected.recording_url && (
                          <Button size="sm" onClick={() => downloadRecording(selected)}>
                            <Download className="h-3.5 w-3.5" /> Recording
                          </Button>
                        )}
                      </div>
                    </div>
                    {selected.recording_url && (
                      <div className="border-b border-border p-4">
                        <audio controls src={selected.recording_url} className="w-full" />
                      </div>
                    )}
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {Array.isArray(selected.transcript) && selected.transcript.length > 0 ? (
                        (selected.transcript as any[]).map((t, i) => (
                          <div key={i} className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm",
                            t.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "bg-secondary")}>
                            <div className="text-[10px] uppercase opacity-60">{t.role}</div>
                            <div>{t.text || t.message || ""}</div>
                          </div>
                        ))
                      ) : transcriptToText(selected.transcript) ? (
                        <pre className="whitespace-pre-wrap text-sm text-foreground/80">{transcriptToText(selected.transcript)}</pre>
                      ) : (
                        <div className="grid h-full place-items-center text-sm text-muted-foreground">
                          <div className="text-center">
                            <PlayCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            No transcript captured for this call yet.
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">Select a call to inspect.</div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Transcriptions;