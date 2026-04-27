import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const defaultFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!sid || !token) throw new Error("Twilio credentials not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { agentId, toNumber, fromNumber } = await req.json();
    if (!agentId || !toNumber) throw new Error("agentId and toNumber required");

    const { data: agent } = await supabase.from("agents").select("name, first_message, org_id").eq("id", agentId).single();
    if (!agent) throw new Error("Agent not found");

    const from = fromNumber || defaultFrom;
    if (!from) throw new Error("No 'from' number. Set TWILIO_PHONE_NUMBER or pass fromNumber.");

    const greeting = (agent.first_message || `Hello, this is ${agent.name}.`).replace(/[<&>]/g, "");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${greeting}</Say><Pause length="1"/></Response>`;

    const body = new URLSearchParams({
      To: toNumber,
      From: from,
      Twiml: twiml,
    });

    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${token}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data?.message || "Twilio call failed");

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("calls").insert({
      user_id: user!.id,
      org_id: (agent as any).org_id ?? null,
      agent_id: agentId,
      direction: "outbound",
      to_number: toNumber,
      from_number: from,
      status: "queued",
      vapi_call_id: data.sid,
    });

    return new Response(JSON.stringify({ callId: data.sid, status: data.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});