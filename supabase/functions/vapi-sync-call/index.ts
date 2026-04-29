import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const pickRecordingUrl = (data: any): string | null => {
  const direct = [
    data?.recordingUrl,
    data?.stereoRecordingUrl,
    data?.monoRecordingUrl,
    data?.recording?.url,
    data?.recording?.recordingUrl,
    data?.artifact?.recordingUrl,
    data?.artifacts?.recordingUrl,
  ].find((v) => typeof v === "string" && v.length > 0);
  return direct ?? null;
};

const normalizeTranscript = (data: any) => {
  if (Array.isArray(data?.transcript)) return data.transcript;
  if (Array.isArray(data?.messages)) {
    return data.messages
      .filter((m: any) => m?.message || m?.text)
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        text: m.message ?? m.text ?? "",
      }));
  }
  return data?.transcript ?? null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Not authenticated" }, 401);

    const VAPI_KEY = Deno.env.get("VAPI_PRIVATE_KEY") || Deno.env.get("VAPI_API_KEY") || Deno.env.get("VAPI_PRIVATE_API") || Deno.env.get("VAPI_API");
    if (!VAPI_KEY) return json({ error: "VAPI private key missing" }, 200); // return 200 to avoid console spam

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { callId } = await req.json().catch(() => ({}));
    if (!callId) return json({ error: "callId required" }, 200);

    // Skip syncing if it's a Twilio Call SID (starts with CA) or an Ultravox call id (not a vapi call)
    if (callId.startsWith("CA") || callId.startsWith("c-")) {
      return json({ ok: true, skipped: true, reason: "Not a Vapi call ID" });
    }

    const r = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${VAPI_KEY}` },
    });
    const data = await r.json().catch(() => ({}));
    // Return 200 even on error to prevent browser console error spam from background polling
    if (!r.ok) return json({ error: data?.message || "Could not fetch call from Vapi", details: data }, 200);

    const startedAt = data?.startedAt ? new Date(data.startedAt).getTime() : null;
    const endedAt = data?.endedAt ? new Date(data.endedAt).getTime() : null;
    const durationSec =
      typeof data?.durationSeconds === "number"
        ? data.durationSeconds
        : (startedAt && endedAt && endedAt > startedAt)
          ? Math.round((endedAt - startedAt) / 1000)
          : undefined;

    const status =
      data?.status === "ended" || data?.endedAt ? "completed" :
      data?.status === "queued" ? "queued" :
      data?.status === "in-progress" || data?.status === "active" ? "in_progress" :
      undefined;

    const update: Record<string, unknown> = {
      transcript: normalizeTranscript(data),
    };
    if (typeof durationSec === "number") update.duration_sec = durationSec;
    if (status) update.status = status;
    const recordingUrl = pickRecordingUrl(data);
    if (recordingUrl) update.recording_url = recordingUrl;

    const { error: upErr } = await supabase
      .from("calls")
      .update(update)
      .eq("vapi_call_id", callId);
    if (upErr) return json({ error: upErr.message }, 200);

    return json({
      ok: true,
      status: update.status ?? null,
      duration_sec: update.duration_sec ?? null,
      recording_url: update.recording_url ?? null,
      has_transcript: Boolean(update.transcript),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
