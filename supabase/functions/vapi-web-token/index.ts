import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fallbackVoices = [
  { id: "jennifer", label: "Jennifer", description: "Warm, professional", provider: "11labs", language: "en-US" },
  { id: "ryan", label: "Ryan", description: "Confident, clear", provider: "11labs", language: "en-US" },
  { id: "sarah", label: "Sarah", description: "Friendly, British", provider: "11labs", language: "en-GB" },
  { id: "mark", label: "Mark", description: "Calm, reassuring", provider: "11labs", language: "en-US" },
  { id: "ava", label: "Ava", description: "Bright, youthful", provider: "11labs", language: "en-US" },
  { id: "leo", label: "Leo", description: "Deep, authoritative", provider: "11labs", language: "en-US" },
];

const fallbackLanguages = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "hi-IN", label: "Hindi" },
  { id: "pt-BR", label: "Portuguese (BR)" },
  { id: "it-IT", label: "Italian" },
  { id: "ja-JP", label: "Japanese" },
  { id: "zh-CN", label: "Mandarin" },
];

const toLabel = (languageCode?: string, languageName?: string) => {
  if (languageCode && languageName) return `${languageName} (${languageCode})`;
  return languageName || languageCode || "Unknown";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPI_KEY = Deno.env.get("VAPI_API");
    if (!VAPI_KEY) throw new Error("VAPI_API secret not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body?.action ?? "token";

    if (action === "config") {
      const voiceResp = await fetch("https://api.vapi.ai/voice-library/11labs?limit=24", {
        headers: { Authorization: `Bearer ${VAPI_KEY}` },
      });

      if (!voiceResp.ok) {
        const text = await voiceResp.text();
        console.error("vapi voice library error", voiceResp.status, text);
        return new Response(JSON.stringify({ voices: fallbackVoices, languages: fallbackLanguages }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const voiceData = await voiceResp.json();
      const voices = Array.isArray(voiceData)
        ? voiceData
            .map((voice: any) => ({
              id: voice.providerId || voice.slug || voice.id,
              label: voice.name || voice.providerId || voice.slug || "Voice",
              description: [voice.language || voice.languageCode, voice.gender, voice.description]
                .filter(Boolean)
                .join(" · ") || "Natural voice",
              provider: voice.provider || "11labs",
              language: voice.languageCode || voice.language,
            }))
            .filter((voice: any) => Boolean(voice.id))
        : fallbackVoices;

      const languagesMap = new Map<string, { id: string; label: string }>();
      for (const voice of Array.isArray(voiceData) ? voiceData : []) {
        const code = voice.languageCode || voice.language;
        if (!code || languagesMap.has(code)) continue;
        languagesMap.set(code, { id: code, label: toLabel(code, voice.language) });
      }

      return new Response(JSON.stringify({
        voices: voices.length ? voices : fallbackVoices,
        languages: Array.from(languagesMap.values()).length ? Array.from(languagesMap.values()) : fallbackLanguages,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenResp = await fetch("https://api.vapi.ai/token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag: "public",
        name: `hexatalks-web-${crypto.randomUUID().slice(0, 8)}`,
      }),
    });

    const tokenData = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok) {
      const message = tokenData?.message || tokenData?.error || "Could not create Vapi web token";
      return new Response(JSON.stringify({ error: message, details: tokenData }), {
        status: tokenResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicKey = tokenData?.value;
    if (!publicKey) throw new Error("Vapi did not return a public token");

    return new Response(JSON.stringify({ publicKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("vapi-web-token error", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
