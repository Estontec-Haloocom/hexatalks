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

const QUALITY_GUARDRAILS = `## Reliability Rules
- Never invent facts, names, prices, policies, or availability.
- If information is missing or unclear, ask a brief clarifying question before proceeding.
- Repeat back critical details (name, phone, date/time, quantity) and get confirmation.
- Keep responses short, human, and conversational unless user asks for more detail.
- If uncertain, explicitly say you are not sure and offer the next best action.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      action = "call",
      systemPrompt,
      firstSpeaker = "FIRST_SPEAKER_AGENT",
      voice,
      languageHint,
      model = "fixie-ai/ultravox",
      temperature = 0.25,
      maxDurationSec = 600,
      medium = "web",
      twilioOutgoing,
      agentId,
      callerNumber,
      ultravox_api_key,
    } = body ?? {};

    const KEY = ultravox_api_key || Deno.env.get("ULTRAVOX_API_KEY");
    if (!KEY) return json({ error: "ULTRAVOX_API_KEY not configured" }, 400);

    if (action === "wallet") {
      try {
        const res = await fetch("https://api.ultravox.ai/api/me", {
          headers: { "X-API-Key": KEY },
        });
        if (!res.ok) throw new Error("Ultravox wallet fetch failed");
        const data = await res.json();
        // Ultravox doesn't provide direct balance in /me always, but we'll try to get it if available
        // or return a placeholder if not.
        return json({ balance: data.balance ?? 0, user: data.username });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed to fetch wallet" }, 500);
      }
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    if (!systemPrompt) return json({ error: "systemPrompt required" }, 400);
    const safeSystemPrompt = [systemPrompt, QUALITY_GUARDRAILS].filter(Boolean).join("\n\n");

    const payload: Record<string, unknown> = {
      systemPrompt: safeSystemPrompt,
      model,
      temperature: Number(temperature) || 0.25,
      firstSpeaker,
      maxDuration: `${Math.max(30, Number(maxDurationSec) || 600)}s`,
      medium: medium === "twilio" ? { twilio: {} } : { webRtc: {} },
    };
    if (voice) payload.systemVoice = voice;
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
    // If the call fails and a voice was provided, retry once without the voice to ensure the call connects.
    if (!r.ok && (voice || languageHint)) {
      console.warn("ultravox call failed, retrying with minimal payload:", voice, data);
      delete (payload as any).systemVoice;
      delete (payload as any).voice; // just in case
      delete (payload as any).languageHint;
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
        const { data: ag } = await supabase.from("agents").select("org_id").eq("id", agentId).maybeSingle();
        await supabase.from("calls").insert({
          user_id: user.id,
          org_id: (ag as any)?.org_id ?? null,
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
