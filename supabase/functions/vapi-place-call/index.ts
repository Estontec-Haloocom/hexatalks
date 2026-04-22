import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPI_KEY = Deno.env.get("VAPI_API");
    if (!VAPI_KEY) throw new Error("VAPI_API secret not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { agentId, toNumber } = await req.json();
    if (!agentId || !toNumber) throw new Error("agentId and toNumber required");

    const { data: agent, error: agentErr } = await supabase
      .from("agents").select("*").eq("id", agentId).single();
    if (agentErr || !agent) throw new Error("Agent not found");

    // Find a phone number for this user
    const { data: phones } = await supabase
      .from("phone_numbers").select("*").limit(1);
    const phone = phones?.[0];
    if (!phone?.vapi_number_id) {
      throw new Error("No phone number attached. Add one in Phone numbers.");
    }

    const voiceId = VOICE_MAP[agent.voice_id] ?? agent.voice_id;

    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: phone.vapi_number_id,
        customer: { number: toNumber },
        assistant: {
          name: agent.name,
          firstMessage: agent.first_message,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            temperature: Number(agent.temperature ?? 0.7),
            messages: [{ role: "system", content: agent.system_prompt }],
          },
          voice: { provider: "11labs", voiceId },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Vapi call failed");

    // Log the call
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("calls").insert({
      user_id: user!.id,
      agent_id: agentId,
      direction: "outbound",
      to_number: toNumber,
      status: "queued",
      vapi_call_id: data.id,
    });

    return new Response(JSON.stringify({ callId: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
