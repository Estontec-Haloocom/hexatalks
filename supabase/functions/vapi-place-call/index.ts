import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildBlocks = async (supabase: any) => {
  const { data } = await supabase
    .from("prompt_blocks")
    .select("name,content,enabled,position")
    .eq("enabled", true)
    .order("position", { ascending: true });
  return (data ?? [])
    .filter((b: any) => b.content?.trim())
    .map((b: any) => `## ${b.name}\n${b.content.trim()}`)
    .join("\n\n");
};

const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

// Single fixed Twilio caller ID for ALL outbound calls.
const DEFAULT_FROM = "+14234608558";

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

    // Read user dev settings
    const { data: settings } = await supabase
      .from("dev_settings").select("voice_platform").maybeSingle();
    const platform = settings?.voice_platform === "ultravox" ? "ultravox" : "vapi";

    const blocksText = await buildBlocks(supabase);

    const tSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tTok = Deno.env.get("TWILIO_AUTH_TOKEN");
    const tFrom = DEFAULT_FROM;
    if (!tSid || !tTok) throw new Error("Twilio credentials not configured");

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
    const systemPromptLocalized = [agent.system_prompt || "", blocksText, languageDirective].filter(Boolean).join("\n\n");

    if (platform === "ultravox") {
      const ULTRAVOX_KEY = Deno.env.get("ULTRAVOX_API_KEY");
      if (!ULTRAVOX_KEY) throw new Error("ULTRAVOX_API_KEY not configured");

      const greeting = agent.first_message ? `# Greeting\nStart by saying: "${agent.first_message}"\n\n` : "";
      const r = await fetch("https://api.ultravox.ai/api/calls", {
        method: "POST",
        headers: { "X-API-Key": ULTRAVOX_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: greeting + systemPromptLocalized,
          model: "fixie-ai/ultravox",
          voice: agent.voice_id,
          languageHint: langShort,
          temperature: Number(agent.temperature ?? 0.5),
          firstSpeaker: "FIRST_SPEAKER_AGENT",
          medium: { twilio: {} },
        }),
      });
      const ud = await r.json();
      if (!r.ok) throw new Error(ud?.detail || ud?.message || "Ultravox call create failed");
      if (!ud.joinUrl) throw new Error("Ultravox did not return a joinUrl");

      // Bridge Twilio outbound call to Ultravox via Media Streams
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${ud.joinUrl}"/></Connect></Response>`;
      const tBody = new URLSearchParams({ To: toNumber, From: tFrom, Twiml: twiml });
      const tr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tSid}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${tSid}:${tTok}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tBody,
      });
      const td = await tr.json();
      if (!tr.ok) throw new Error(td?.message || "Twilio dial failed");

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("calls").insert({
        user_id: user!.id,
        agent_id: agentId,
        direction: "outbound",
        to_number: toNumber,
        from_number: tFrom,
        status: "queued",
        vapi_call_id: td.sid,
      });
      return new Response(JSON.stringify({ callId: td.sid, ultravoxCallId: ud.callId || ud.id, platform: "ultravox+twilio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vapi platform: dial via Twilio (fixed caller ID) and bridge to Vapi assistant via Media Streams.
    // First, create a transient Vapi assistant + call session that returns a stream URL.
    const vapiCreate = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transport: { provider: "vapi.websocket" },
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
    const vapiData = await vapiCreate.json();
    if (!vapiCreate.ok) throw new Error(vapiData?.message || "Vapi call create failed");
    const streamUrl = vapiData?.transport?.websocketCallUrl || vapiData?.websocketCallUrl;
    if (!streamUrl) throw new Error("Vapi did not return a stream URL");

    // Dial customer via Twilio from the fixed default caller ID and bridge to Vapi.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${streamUrl}"/></Connect></Response>`;
    const tBody = new URLSearchParams({ To: toNumber, From: tFrom, Twiml: twiml });
    const tr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tSid}/Calls.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${tSid}:${tTok}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: tBody,
    });
    const td = await tr.json();
    if (!tr.ok) throw new Error(td?.message || "Twilio dial failed");

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("calls").insert({
      user_id: user!.id,
      agent_id: agentId,
      direction: "outbound",
      to_number: toNumber,
      from_number: tFrom,
      status: "queued",
      vapi_call_id: td.sid,
    });

    return new Response(JSON.stringify({ callId: td.sid, vapiCallId: vapiData.id, platform: "vapi+twilio" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
