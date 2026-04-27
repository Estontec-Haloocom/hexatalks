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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KEY = Deno.env.get("ULTRAVOX_API_KEY");
    if (!KEY) return json({ error: "ULTRAVOX_API_KEY not configured" }, 400);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const body = await req.json().catch(() => ({}));
    const {
      systemPrompt,
      firstSpeaker = "FIRST_SPEAKER_AGENT", // agent greets first
      voice,                                // ultravox voice id (e.g. "Mark") — optional
      languageHint,                         // e.g. "en", "hi"
      model = "fixie-ai/ultravox",
      temperature = 0.5,
      maxDurationSec = 600,
      medium = "web",                       // "web" or "twilio"
      twilioOutgoing,                       // for outbound twilio: { to: "+1..." }
      agentId,
      callerNumber,
    } = body ?? {};

    if (!systemPrompt) return json({ error: "systemPrompt required" }, 400);

    const payload: Record<string, unknown> = {
      systemPrompt,
      model,
      temperature: Number(temperature) || 0.5,
      firstSpeaker,
      maxDuration: `${Math.max(30, Number(maxDurationSec) || 600)}s`,
      medium: medium === "twilio" ? { twilio: {} } : { webRtc: {} },
    };
    if (voice) payload.voice = voice;
    if (languageHint) payload.languageHint = languageHint;

    const r = await fetch("https://api.ultravox.ai/api/calls", {
      method: "POST",
      headers: {
        "X-API-Key": KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    let data = await r.json();
    // If the chosen voice doesn't exist, retry once without a voice (use Ultravox default).
    if (!r.ok && voice && JSON.stringify(data).toLowerCase().includes("voice")) {
      console.warn("ultravox voice rejected, retrying without voice:", voice, data);
      delete (payload as any).voice;
      const r2 = await fetch("https://api.ultravox.ai/api/calls", {
        method: "POST",
        headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await r2.json();
      if (!r2.ok) {
        console.error("ultravox create call failed (retry)", r2.status, data);
        return json({ error: data?.detail || data?.message || "Ultravox call create failed", details: data }, r2.status);
      }
    } else if (!r.ok) {
      console.error("ultravox create call failed", r.status, data);
      return json({ error: data?.detail || data?.message || "Ultravox call create failed", details: data }, r.status);
    }

    // Log call (web). Outbound twilio path is handled by caller-side bridging.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && agentId) {
        await supabase.from("calls").insert({
          user_id: user.id,
          agent_id: agentId,
          direction: medium === "twilio" ? "outbound" : "outbound",
          to_number: callerNumber || twilioOutgoing?.to || null,
          status: "queued",
          vapi_call_id: data.callId || data.id || null,
        });
      }
    } catch (e) {
      console.warn("call log skipped", e);
    }

    return json({
      callId: data.callId || data.id,
      joinUrl: data.joinUrl,
      raw: data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});