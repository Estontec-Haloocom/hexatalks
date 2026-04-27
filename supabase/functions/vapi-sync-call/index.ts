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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Not authenticated" }, 401);

    const VAPI_KEY = Deno.env.get("VAPI_PRIVATE_API") || Deno.env.get("VAPI_API");
    if (!VAPI_KEY) return json({ error: "VAPI private key missing" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { callId } = await req.json().catch(() => ({}));
    if (!callId) return json({ error: "callId required" }, 400);

    const r = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${VAPI_KEY}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || "Could not fetch call from Vapi", details: data }, 400);

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
      transcript: data?.transcript ?? null,
    };
    if (typeof durationSec === "number") update.duration_sec = durationSec;
    if (status) update.status = status;

    const { error: upErr } = await supabase
      .from("calls")
      .update(update)
      .eq("vapi_call_id", callId);
    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true, status: update.status ?? null, duration_sec: update.duration_sec ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
