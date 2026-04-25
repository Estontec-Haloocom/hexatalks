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
    const voiceProvider = agent.voice_provider || "11labs";

    const fullLang = (agent.language || "en-US") as string;
    const langShort = fullLang.split("-")[0].toLowerCase();
    const LANG_NAMES: Record<string, string> = {
      en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German",
      pt: "Portuguese", it: "Italian", ja: "Japanese", zh: "Mandarin Chinese",
      ar: "Arabic", ru: "Russian", nl: "Dutch", pl: "Polish", tr: "Turkish",
      ko: "Korean", id: "Indonesian", vi: "Vietnamese", th: "Thai",
    };
    const langName = LANG_NAMES[langShort] || fullLang;
    const languageDirective = `\n\n## Language\nYou MUST speak and respond ONLY in ${langName} (${fullLang}) for the entire conversation, including the very first message. Never switch to another language unless the user explicitly asks. Use natural, native phrasing.`;
    const systemPromptLocalized = (agent.system_prompt || "") + languageDirective;

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
            temperature: Number(agent.temperature ?? 0.6),
            maxTokens: 180,
            messages: [{ role: "system", content: systemPromptLocalized }],
          },
          voice: {
            provider: voiceProvider,
            voiceId,
            ...(voiceProvider === "11labs" ? { model: "eleven_multilingual_v2", optimizeStreamingLatency: 3, stability: 0.45, similarityBoost: 0.8, style: 0.15, useSpeakerBoost: true } : {}),
          },
          transcriber: { provider: "deepgram", model: "nova-2-general", language: langShort, smartFormat: true, endpointing: 220 },
          startSpeakingPlan: { waitSeconds: 0.3, smartEndpointingEnabled: true },
          stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.2, backoffSeconds: 1 },
          responseDelaySeconds: 0.2,
          silenceTimeoutSeconds: 30,
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
