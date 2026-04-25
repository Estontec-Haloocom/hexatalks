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

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const listFrom = (data: any) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.voices)) return data.voices;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const textFrom = (...values: any[]) => values.find((value) => typeof value === "string" && value.trim())?.trim();

const toLabel = (languageCode?: string, languageName?: string) => {
  if (languageCode && languageName) return `${languageName} (${languageCode})`;
  return languageName || languageCode || "Unknown";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPI_PRIVATE_KEY = Deno.env.get("VAPI_PRIVATE_API") || Deno.env.get("VAPI_API");
    const VAPI_PUBLIC_KEY = Deno.env.get("VAPI_PUBLIC_KEY");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body?.action ?? "token";

    if (action === "config") {
      if (!VAPI_PRIVATE_KEY) return json({ voices: fallbackVoices, languages: fallbackLanguages });

      const voiceResp = await fetch("https://api.vapi.ai/voice-library/11labs?limit=100", {
        headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` },
      });

      if (!voiceResp.ok) {
        const text = await voiceResp.text();
        console.error("vapi voice library error", voiceResp.status, text);
        return json({ voices: fallbackVoices, languages: fallbackLanguages, warning: "Could not fetch Vapi voices with the configured key." });
      }

      const voiceData = await voiceResp.json();
      const voiceItems = listFrom(voiceData);
      const voices = voiceItems.length
        ? voiceItems
            .map((voice: any) => ({
              id: textFrom(voice.providerId, voice.voiceId, voice.externalId, voice.slug, voice.id),
              label: textFrom(voice.name, voice.providerId, voice.slug, voice.id) || "Voice",
              description: [textFrom(voice.languageName, voice.language, voice.languageCode), voice.gender, voice.description]
                .filter(Boolean)
                .join(" · ") || "Natural voice",
              provider: voice.provider || "11labs",
              language: textFrom(voice.languageCode, voice.language),
              gender: textFrom(voice.gender),
              accent: textFrom(voice.accent, voice.languageName),
              country: textFrom(voice.country, voice.region),
              previewUrl: textFrom(voice.previewUrl, voice.previewURL, voice.sampleUrl),
            }))
            .filter((voice: any) => Boolean(voice.id))
        : fallbackVoices;

      const languagesMap = new Map<string, { id: string; label: string }>();
      for (const voice of voiceItems) {
        const code = textFrom(voice.languageCode, voice.language);
        if (!code || languagesMap.has(code)) continue;
        languagesMap.set(code, { id: code, label: toLabel(code, textFrom(voice.languageName, voice.language)) });
      }

      return json({
        voices: voices.length ? voices : fallbackVoices,
        languages: Array.from(languagesMap.values()).length ? Array.from(languagesMap.values()) : fallbackLanguages,
      });
    }

    if (VAPI_PUBLIC_KEY) return json({ publicKey: VAPI_PUBLIC_KEY });

    if (!VAPI_PRIVATE_KEY) return json({ error: "Vapi key is not configured." });

    const tokenResp = await fetch("https://api.vapi.ai/token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
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
      console.error("vapi token error", tokenResp.status, tokenData);

      if (!Deno.env.get("VAPI_PRIVATE_API") && Deno.env.get("VAPI_API")) {
        return json({ publicKey: Deno.env.get("VAPI_API"), warning: message });
      }

      return json({ error: message, details: tokenData });
    }

    const publicKey = tokenData?.value || tokenData?.token || tokenData?.publicKey;
    if (!publicKey) throw new Error("Vapi did not return a public token");

    return json({ publicKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("vapi-web-token error", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
