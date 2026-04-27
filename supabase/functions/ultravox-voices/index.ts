import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FALLBACK_VOICES = [
  { id: "Mark",           label: "Mark",           description: "Calm, clear · English",     provider: "ultravox", language: "en", gender: "Male",   accent: "American" },
  { id: "Jessica",        label: "Jessica",        description: "Warm, friendly · English",  provider: "ultravox", language: "en", gender: "Female", accent: "American" },
  { id: "Tanya-English",  label: "Tanya",          description: "Bright, youthful · English",provider: "ultravox", language: "en", gender: "Female", accent: "Indian" },
  { id: "Aaron-English",  label: "Aaron",          description: "Deep, confident · English", provider: "ultravox", language: "en", gender: "Male",   accent: "American" },
  { id: "Riya-Rao",       label: "Riya",           description: "Friendly · Hindi/English",  provider: "ultravox", language: "hi", gender: "Female", accent: "Indian" },
  { id: "Anjali",         label: "Anjali",         description: "Soft, professional · Hindi",provider: "ultravox", language: "hi", gender: "Female", accent: "Indian" },
];

const FALLBACK_LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "hi-IN", label: "Hindi" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "pt-BR", label: "Portuguese (BR)" },
  { id: "it-IT", label: "Italian" },
  { id: "ja-JP", label: "Japanese" },
  { id: "zh-CN", label: "Mandarin" },
];

const text = (...vs: any[]) => vs.find((v) => typeof v === "string" && v.trim())?.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KEY = Deno.env.get("ULTRAVOX_API_KEY");
    if (!KEY) return json({ voices: FALLBACK_VOICES, languages: FALLBACK_LANGUAGES, warning: "Ultravox API key not configured." });

    const r = await fetch("https://api.ultravox.ai/api/voices?pageSize=200", {
      headers: { "X-API-Key": KEY },
    });
    if (!r.ok) {
      const t = await r.text();
      console.warn("ultravox voices fetch failed", r.status, t);
      return json({ voices: FALLBACK_VOICES, languages: FALLBACK_LANGUAGES, warning: "Could not fetch Ultravox voices." });
    }
    const data = await r.json();
    const items: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data?.voices) ? data.voices : Array.isArray(data) ? data : [];

    const voices = items
      .map((v: any) => {
        const id = text(v.voiceId, v.name, v.id);
        const label = text(v.name, v.voiceId, v.id) || "Voice";
        const lang = text(v.language, v.languageCode, v.locale);
        return {
          id,
          label,
          description: [text(v.description), lang, text(v.gender), text(v.accent)].filter(Boolean).join(" · ") || "Ultravox voice",
          provider: "ultravox",
          language: lang,
          gender: text(v.gender),
          accent: text(v.accent, v.languageName),
          country: text(v.country),
          previewUrl: text(v.previewUrl, v.previewURL, v.sampleUrl),
        };
      })
      .filter((v: any) => v.id);

    const langMap = new Map<string, { id: string; label: string }>();
    for (const v of items) {
      const code = text(v.language, v.languageCode, v.locale);
      if (!code || langMap.has(code)) continue;
      langMap.set(code, { id: code, label: text(v.languageName) || code });
    }

    return json({
      voices: voices.length ? voices : FALLBACK_VOICES,
      languages: langMap.size ? Array.from(langMap.values()) : FALLBACK_LANGUAGES,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("ultravox-voices error", msg);
    return json({ voices: FALLBACK_VOICES, languages: FALLBACK_LANGUAGES, warning: msg });
  }
});