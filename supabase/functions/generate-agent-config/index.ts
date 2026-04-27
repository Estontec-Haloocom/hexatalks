import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractFirstJsonObject = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const fallbackConfig = (params: {
  industryName?: string;
  businessName?: string;
  language?: string;
  tone?: string;
  description?: string;
  starterPrompt?: string;
}) => {
  const business = params.businessName?.trim() || params.industryName || "Your Business";
  const tone = params.tone || "professional and warm";
  const lang = params.language || "en-US";
  return {
    suggested_name: `${business} Assistant`.slice(0, 48),
    first_message: `Hi, this is ${business}. How can I help you today?`,
    system_prompt: [
      `You are the voice assistant for ${business}.`,
      `Speak in ${lang} with a ${tone} tone.`,
      "Keep responses short and clear.",
      "Ask one question at a time and confirm important details.",
      "Escalate to a human when you are unsure.",
      params.description ? `Business context: ${params.description}` : "",
      params.starterPrompt ? `Starter guidance: ${params.starterPrompt}` : "",
    ].filter(Boolean).join("\n\n"),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { industry, industryName, description, starterPrompt, country, accent, gender, tone, useCases, businessName, language } = await req.json();
    if (!description) {
      return json({ error: "description required" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      const fallback = fallbackConfig({ industryName, businessName, language, tone, description, starterPrompt });
      return json({ ...fallback, fallback: true, warning: "GEMINI_API_KEY missing in Edge Function secrets" }, 200);
    }

    const system = `You design world-class production voice AI agents optimized for ultra-low latency phone conversations.

Hard rules for the system_prompt you write:
- Write in second person ("You are…").
- Open with a 1-line identity (role + business name + region/accent if given).
- Then a "## Personality & tone" block (3-5 bullets) reflecting the requested tone, accent, and cultural style.
- Then a "## Conversation style" block: short sentences (≤15 words), one question at a time, no lists read aloud, use natural fillers sparingly, never say you're an AI unless asked, confirm spellings of names/emails/numbers by reading back digit-by-digit.
- Then a "## Goals" block: numbered, specific to the use cases provided.
- Then a "## Knowledge" block grounded in the business description (hours, services, policies — only what was given; never invent).
- Then a "## Guardrails" block: refuse out-of-scope topics politely, escalate to human when unsure, never give legal/medical/financial advice.
- End with a "## Response format" block: keep replies under 2 sentences unless asked, ask clarifying questions when ambiguous.

The first_message must be ≤18 words, warm, mention the business by name, and end with an open question.
The suggested_name must be 2-3 words, brandable.`;

    const user = `Industry: ${industryName} (${industry})
Business name: ${businessName || "(not provided)"}
Country / market: ${country || "(not provided)"}
Preferred accent / dialect: ${accent || "(not provided)"}
Voice gender: ${gender || "(not provided)"}
Tone: ${tone || "professional, warm"}
Primary language: ${language || "en-US"}
Top use cases: ${(Array.isArray(useCases) ? useCases.join(", ") : useCases) || "(infer from description)"}

Starter template (rewrite, don't copy):
${starterPrompt}

Business description:
${description}

Tailor everything to this specific business, region, and accent. Use locale-appropriate phrasing (e.g. "mate" for AU, "y'all" only if US South, etc.).

Return ONLY valid JSON with keys:
{
  "suggested_name": string,
  "first_message": string,
  "system_prompt": string
}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${system}\n\n${user}` }] },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResp.ok) {
      const t = await geminiResp.text();
      if (geminiResp.status === 429) return json({ error: "Gemini rate limit reached. Try again shortly." }, 429);
      if (geminiResp.status === 403) return json({ error: "Gemini API key is invalid or missing permissions." }, 403);
      const fallback = fallbackConfig({ industryName, businessName, language, tone, description, starterPrompt });
      return json({ ...fallback, fallback: true, warning: `Gemini API failed: ${geminiResp.status}`, details: t }, 200);
    }

    const geminiData = await geminiResp.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractFirstJsonObject(text);
    if (!parsed?.suggested_name || !parsed?.first_message || !parsed?.system_prompt) {
      const fallback = fallbackConfig({ industryName, businessName, language, tone, description, starterPrompt });
      return json({ ...fallback, fallback: true, warning: "Gemini response parsing failed" }, 200);
    }

    return json(parsed);
  } catch (e) {
    console.error("generate-agent-config error", e);
    const fallback = fallbackConfig({});
    return json({ ...fallback, fallback: true, warning: e instanceof Error ? e.message : String(e) }, 200);
  }
});