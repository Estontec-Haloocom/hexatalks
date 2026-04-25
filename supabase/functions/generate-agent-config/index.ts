import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { industry, industryName, description, starterPrompt, country, accent, gender, tone, useCases, businessName, language } = await req.json();
    if (!description) {
      return new Response(JSON.stringify({ error: "description required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

Tailor everything to this specific business, region, and accent. Use locale-appropriate phrasing (e.g. "mate" for AU, "y'all" only if US South, etc.).`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "build_agent",
            description: "Return the configured voice agent.",
            parameters: {
              type: "object",
              properties: {
                suggested_name: { type: "string" },
                first_message: { type: "string" },
                system_prompt: { type: "string" },
              },
              required: ["suggested_name", "first_message", "system_prompt"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_agent" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds to your Lovable workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway: ${resp.status} ${t}`);
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    if (!parsed) throw new Error("No tool call returned");

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-agent-config error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});