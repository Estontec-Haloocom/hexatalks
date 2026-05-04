import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildBlocks = async (supabase: any, orgId: string | null) => {
  if (!orgId) return "";
  const { data } = await supabase
    .from("prompt_blocks")
    .select("name,content,enabled,position")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("position", { ascending: true });
  return (data ?? [])
    .filter((b: any) => b.content?.trim())
    .map((b: any) => `## ${b.name}\n${b.content.trim()}`)
    .join("\n\n");
};

const buildOrgPromptIde = async (supabase: any, orgId: string | null) => {
  if (!orgId) return "";
  const { data } = await supabase
    .from("org_prompt_configs")
    .select("enabled,format,content")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data?.enabled || !data?.content?.trim()) return "";
  const fmt = data.format || "text";
  return `## Organization Prompt IDE (${String(fmt).toUpperCase()})\n\`\`\`${fmt}\n${data.content.trim()}\n\`\`\`\nApply this organization runtime config as high-priority guidance for this organization only.`;
};

const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

const ULTRAVOX_FALLBACK_MAP: Record<string, string> = {
  jennifer: "Jessica",
  sarah: "Jessica",
  ava: "Tanya-English",
  ryan: "Mark",
  mark: "Mark",
  leo: "Mark",
};
const ULTRAVOX_DEFAULT_VOICE = "Mark";

// Single fixed Twilio caller ID for ALL outbound calls.
const DEFAULT_FROM = "+14234608558";

const normalizeE164 = (value: unknown) => {
  const raw = String(value ?? "").trim().replace(/[\s\-().]/g, "");
  const normalized = raw.startsWith("+") ? raw : `+${raw.replace(/^\+?/, "")}`;
  return /^\+\d{8,15}$/.test(normalized) ? normalized : null;
};

const isRestrictedNumber = (value: string) => /^\+1(900|976|809|411|700|500)/.test(value);

const readJson = async (res: Response) => {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { message: text }; }
};

const looksLikePublicVapiKey = (key: string) =>
  /public|pk_/i.test(key);

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const initialGreeting = (agent: any) =>
  xmlEscape((agent?.first_message || `Hello, this is ${agent?.name || "your assistant"}.`).trim());
const QUALITY_GUARDRAILS = `## Reliability Rules
- Never invent facts, names, prices, policies, or availability.
- If information is missing or unclear, ask a brief clarifying question before proceeding.
- Repeat back critical details (name, phone, date/time, quantity) and get confirmation.
- Keep responses short, human, and conversational unless user asks for more detail.
- If uncertain, explicitly say you are not sure and offer the next best action.`;


const toTwilioWsUrl = (value: string) => {
  if (!value) return value;
  if (value.startsWith("wss://")) return value;
  if (value.startsWith("ws://")) return "wss://" + value.slice("ws://".length);
  if (value.startsWith("https://")) return "wss://" + value.slice("https://".length);
  if (value.startsWith("http://")) return "wss://" + value.slice("http://".length);
  return value;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { agentId, toNumber } = await req.json();
    const cleanToNumber = normalizeE164(toNumber);
    if (!agentId || !cleanToNumber) throw new Error("Enter a valid destination number with country code, for example +919876543210.");
    if (isRestrictedNumber(cleanToNumber)) throw new Error("Premium or special-service numbers are blocked. Use a regular mobile or landline number.");

    const { data: agent, error: agentErr } = await supabase
      .from("agents").select("*").eq("id", agentId).single();
    if (agentErr || !agent) throw new Error("Agent not found");

    // Read user dev settings
    const { data: settings } = await supabase
      .from("dev_settings").select("voice_platform,dev_mode_enabled,vapi_private_key,ultravox_api_key").maybeSingle();

    const useCustomKeys = settings?.dev_mode_enabled;
    // Routing rule:
    // - If developer selected Ultravox -> use Ultravox
    // - If agent voice provider is Ultravox -> use Ultravox
    // - Otherwise default to Vapi
    const platform =
      settings?.voice_platform === "ultravox" || agent?.voice_provider === "ultravox"
        ? "ultravox"
        : "vapi";

    const blocksText = await buildBlocks(supabase, agent.org_id ?? null);
    const orgPromptIdeText = await buildOrgPromptIde(supabase, agent.org_id ?? null);

    const tSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tTok = Deno.env.get("TWILIO_AUTH_TOKEN");
    const tFrom = DEFAULT_FROM;
    if (!tSid || !tTok) throw new Error("Twilio credentials not configured");

    const voiceId = VOICE_MAP[agent.voice_id] ?? agent.voice_id;
    const voiceProvider = agent.voice_provider || "11labs";

    const fullLang = (agent.language || "en-US") as string;
    const primaryLang = fullLang.split(",")[0];

    const parseDelimited = (text: string | null | undefined, defaultLang: string) => {
      if (!text) return { [defaultLang]: "" };
      if (!text.includes("===LANG:")) {
        return { [defaultLang]: text };
      }
      const result: Record<string, string> = {};
      const parts = text.split(/===LANG:([a-zA-Z0-9-]+)===/);
      for (let i = 1; i < parts.length; i += 2) {
        result[parts[i]] = parts[i+1].trim();
      }
      return result;
    };

    const languageDisplayName = (langCode: string) => {
      const short = (langCode || "en").split("-")[0].toLowerCase();
      const NAMES: Record<string, string> = {
        en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German",
        pt: "Portuguese", it: "Italian", ja: "Japanese", zh: "Mandarin Chinese",
        ar: "Arabic", ru: "Russian", nl: "Dutch", pl: "Polish", tr: "Turkish",
        ko: "Korean", id: "Indonesian", vi: "Vietnamese", th: "Thai", kn: "Kannada",
      };
      return NAMES[short] || langCode;
    };

    const sysPrompts = parseDelimited(agent.system_prompt, primaryLang);
    const firstMsgs = parseDelimited(agent.first_message, primaryLang);

    let combinedSystemPrompt = "";
    let combinedFirstMessage = "";
    const langs = fullLang.split(",");

    if (langs.length > 1) {
      const langNamesList = langs.map((l) => languageDisplayName(l));
      const selectionPrompt = `Hello. I can continue in ${langNamesList.slice(0, -1).join(", ")} or ${langNamesList.slice(-1)}. Please tell me which language you prefer?`;

      combinedSystemPrompt = `You are a professional multilingual AI assistant.

## Multilingual Runtime Rules
- **CRITICAL**: Your very first response MUST be exactly: "${selectionPrompt}"
- **DO NOT** perform any business logic, greeting, or assistance until the user has explicitly chosen a language from the allowed list: ${langNamesList.join(", ")}.
- Once the user selects a language, you must switch to that language's specific rules and tone IMMEDIATELY.
- **Robust Switching**: If at any point during the conversation the user says "Switch to [Language]" or starts speaking in one of the other allowed languages, you MUST switch your response language to match them immediately and stay in that language until requested otherwise.
- Always maintain the character and tone defined in the language-specific rules below.

`;
      langs.forEach((l) => {
        if (sysPrompts[l]) combinedSystemPrompt += `### Rules for ${languageDisplayName(l)} (${l}):\n${sysPrompts[l]}\n\n`;
      });
      combinedFirstMessage = selectionPrompt;
    } else {
      combinedSystemPrompt = sysPrompts[primaryLang] || "";
      combinedFirstMessage = firstMsgs[primaryLang] || "";
    }
    combinedFirstMessage = combinedFirstMessage.trim();

    const validNovaLangs = ["bg", "ca", "zh", "zh-CN", "zh-HK", "zh-Hans", "zh-TW", "zh-Hant", "cs", "da", "da-DK", "nl", "en", "en-US", "en-AU", "en-GB", "en-NZ", "en-IN", "et", "fi", "nl-BE", "fr", "fr-CA", "de", "de-CH", "el", "hi", "hu", "id", "it", "ja", "ko", "ko-KR", "lv", "lt", "ms", "multi", "no", "pl", "pt", "pt-BR", "ro", "ru", "sk", "es", "es-419", "sv", "sv-SE", "th", "th-TH", "tr", "uk", "vi"];
    let langShort = fullLang;
    let languageDirective = "";

    if (fullLang.includes(",")) {
        langShort = "multi";
        languageDirective = `\n\n## Language\nYou MUST seamlessly speak and understand the following languages: ${fullLang}. ALWAYS include a greeting in all these languages in your first message, and then automatically switch to whichever language the user speaks to you in.`;
    } else {
        if (!validNovaLangs.includes(langShort)) {
            langShort = fullLang.split("-")[0].toLowerCase();
            if (!validNovaLangs.includes(langShort)) {
                langShort = "multi";
            }
        }
        const LANG_NAMES: Record<string, string> = {
          en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German",
          pt: "Portuguese", it: "Italian", ja: "Japanese", zh: "Mandarin Chinese",
          ar: "Arabic", ru: "Russian", nl: "Dutch", pl: "Polish", tr: "Turkish",
          ko: "Korean", id: "Indonesian", vi: "Vietnamese", th: "Thai",
        };
        const langName = LANG_NAMES[langShort] || fullLang;
        languageDirective = `\n\n## Language\nYou MUST speak and respond ONLY in ${langName} (${fullLang}) for the entire conversation, including the very first message. Never switch to another language unless the user explicitly asks. Use natural, native phrasing.`;
    }
    
    const systemPromptLocalized = [combinedSystemPrompt, blocksText, orgPromptIdeText, languageDirective, QUALITY_GUARDRAILS].filter(Boolean).join("\n\n");

    if (platform === "ultravox") {
      const ULTRAVOX_KEY = (useCustomKeys ? settings?.ultravox_api_key : undefined) || Deno.env.get("ULTRAVOX_API_KEY");
      if (!ULTRAVOX_KEY) throw new Error("ULTRAVOX_API_KEY not configured");
      const isUltravoxVoice = agent.voice_provider === "ultravox";
      const uvVoice = isUltravoxVoice
        ? agent.voice_id
        : ULTRAVOX_FALLBACK_MAP[String(agent.voice_id ?? "").toLowerCase()] ?? ULTRAVOX_DEFAULT_VOICE;

      const greeting = combinedFirstMessage ? `# Greeting\nStart by saying: "${combinedFirstMessage}"\n\n` : "";
      const ultravoxPayload: Record<string, unknown> = {
        systemPrompt: greeting + systemPromptLocalized,
        model: "fixie-ai/ultravox",
        systemVoice: uvVoice,
        languageHint: langShort,
        temperature: Number(agent.temperature ?? 0.25),
        firstSpeaker: "FIRST_SPEAKER_AGENT",
        medium: { twilio: {} },
      };
      const r = await fetch("https://api.ultravox.ai/api/calls", {
        method: "POST",
        headers: { "X-API-Key": ULTRAVOX_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(ultravoxPayload),
      });
      let ud = await readJson(r);
      if (!r.ok && (agent.voice_id || langShort)) {
        console.warn("Ultravox call create failed, retrying with minimal payload", r.status, ud);
        delete ultravoxPayload.systemVoice;
        delete ultravoxPayload.voice; // just in case
        delete ultravoxPayload.languageHint;
        const retry = await fetch("https://api.ultravox.ai/api/calls", {
          method: "POST",
          headers: { "X-API-Key": ULTRAVOX_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(ultravoxPayload),
        });
        ud = await readJson(retry);
        if (!retry.ok) throw new Error(ud?.detail || ud?.message || ud?.error || "Ultravox call create failed");
      } else if (!r.ok) {
        throw new Error(ud?.detail || ud?.message || ud?.error || "Ultravox call create failed");
      }
      if (!ud.joinUrl) throw new Error("Ultravox did not return a joinUrl");

      // Bridge Twilio outbound call to Ultravox via Media Streams
      // Ultravox should speak in the configured agent voice immediately.
      // Do not prepend Twilio TTS greeting, otherwise callers hear a mismatched voice first.
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${ud.joinUrl}"/></Connect></Response>`;
      const tBody = new URLSearchParams({ To: cleanToNumber, From: tFrom, Twiml: twiml });
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
        org_id: agent.org_id ?? null,
        agent_id: agentId,
        direction: "outbound",
          to_number: cleanToNumber,
        from_number: tFrom,
        status: "queued",
        vapi_call_id: td.sid,
      });
      return new Response(JSON.stringify({ ok: true, callId: td.sid, ultravoxCallId: ud.callId || ud.id, platform: "ultravox+twilio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VAPI_KEY = (useCustomKeys ? settings?.vapi_private_key : undefined) || Deno.env.get("VAPI_PRIVATE_API") || Deno.env.get("VAPI_API");
    if (!VAPI_KEY) throw new Error("VAPI private key missing. Set VAPI_PRIVATE_API in Supabase secrets.");
    if (looksLikePublicVapiKey(VAPI_KEY)) {
      throw new Error("Invalid Vapi key for outbound calls. Set VAPI_PRIVATE_API to your private server key (not public/web key).");
    }

    // Preferred: native Vapi PSTN outbound (most reliable speech path).
    let outboundPhoneNumberId = Deno.env.get("VAPI_OUTBOUND_PHONE_NUMBER_ID");

    if (useCustomKeys && settings?.vapi_private_key) {
      try {
        const pnRes = await fetch("https://api.vapi.ai/phone-number", {
          headers: { Authorization: `Bearer ${settings.vapi_private_key}` }
        });
        if (pnRes.ok) {
          const pns = await pnRes.json();
          if (Array.isArray(pns) && pns.length > 0) {
            outboundPhoneNumberId = pns[0].id;
          } else {
            outboundPhoneNumberId = undefined; // User has no phone numbers configured
          }
        } else {
          outboundPhoneNumberId = undefined;
        }
      } catch (e) {
        console.warn("Failed to fetch custom Vapi phone numbers", e);
        outboundPhoneNumberId = undefined;
      }
    }

    if (outboundPhoneNumberId) {
      const nativeCreate = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { number: cleanToNumber },
          phoneNumberId: outboundPhoneNumberId,
          assistant: {
            name: agent.name,
            firstMessage: combinedFirstMessage,
            firstMessageMode: "assistant-speaks-first",
            model: {
              provider: agent.model_provider || "openai",
              model: agent.model || "gpt-4o-mini",
              temperature: Number(agent.temperature ?? 0.2),
              maxTokens: 140,
              messages: [{ role: "system", content: systemPromptLocalized }],
            },
            voice: voiceProvider === "vapi"
              ? { voiceId }
              : {
                  provider: voiceProvider,
                  voiceId,
                  ...(voiceProvider === "11labs" && !voiceId.includes("vapi") ? { model: "eleven_multilingual_v2", optimizeStreamingLatency: 3, stability: 0.45, similarityBoost: 0.8, style: 0.15, useSpeakerBoost: true } : {}),
                },
            transcriber: { provider: "deepgram", model: "nova-2-general", language: langShort, smartFormat: true, endpointing: 140 },
            startSpeakingPlan: { waitSeconds: 0.15, smartEndpointingEnabled: true },
            stopSpeakingPlan: { numWords: 1, voiceSeconds: 0.12, backoffSeconds: 0.5 },
            responseDelaySeconds: 0.05,
            silenceTimeoutSeconds: 20,
          },
        }),
      });
      const nativeData = await nativeCreate.json();
      if (!nativeCreate.ok) {
        const msg = nativeData?.message || nativeData?.error || "Vapi native outbound failed";
        throw new Error(msg);
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("calls").insert({
        user_id: user!.id,
        org_id: agent.org_id ?? null,
        agent_id: agentId,
        direction: "outbound",
        to_number: cleanToNumber,
        from_number: tFrom,
        status: "queued",
        vapi_call_id: nativeData.id ?? null,
      });
      return new Response(JSON.stringify({ ok: true, callId: nativeData.id, vapiCallId: nativeData.id, platform: "vapi-native" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: Twilio bridge to Vapi websocket (requires stable stream setup).
    const vapiCreate = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Twilio is the caller leg; Vapi should not dial customer directly here.
        transport: { provider: "vapi.websocket" },
        assistant: {
          name: agent.name,
          firstMessage: combinedFirstMessage,
          firstMessageMode: "assistant-speaks-first",
          model: {
            provider: agent.model_provider || "openai",
            model: agent.model || "gpt-4o-mini",
            temperature: Number(agent.temperature ?? 0.2),
            maxTokens: 140,
            messages: [{ role: "system", content: systemPromptLocalized }],
          },
          voice: {
            provider: voiceProvider,
            voiceId,
            ...(voiceProvider === "11labs" ? { model: "eleven_multilingual_v2", optimizeStreamingLatency: 3, stability: 0.45, similarityBoost: 0.8, style: 0.15, useSpeakerBoost: true } : {}),
          },
          transcriber: { provider: "deepgram", model: "nova-2-general", language: langShort, smartFormat: true, endpointing: 140 },
          startSpeakingPlan: { waitSeconds: 0.15, smartEndpointingEnabled: true },
          stopSpeakingPlan: { numWords: 1, voiceSeconds: 0.12, backoffSeconds: 0.5 },
          responseDelaySeconds: 0.05,
          silenceTimeoutSeconds: 20,
        },
      }),
    });
    const vapiData = await vapiCreate.json();
    if (!vapiCreate.ok) {
      const msg = vapiData?.message || vapiData?.error || "Vapi call create failed";
      if (/invalid key|private key|public key/i.test(String(msg))) {
        throw new Error("Vapi outbound auth failed. Use VAPI_PRIVATE_API secret with your private server key.");
      }
      throw new Error(msg);
    }
    const streamUrlRaw = vapiData?.transport?.websocketCallUrl || vapiData?.websocketCallUrl;
    const streamUrl = toTwilioWsUrl(streamUrlRaw);
    if (!streamUrl) throw new Error("Vapi did not return a stream URL");

    // Dial customer via Twilio from the fixed default caller ID and bridge to Vapi.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${streamUrl}"/></Connect></Response>`;
    const tBody = new URLSearchParams({ To: cleanToNumber, From: tFrom, Twiml: twiml });
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
      org_id: agent.org_id ?? null,
      agent_id: agentId,
      direction: "outbound",
      to_number: cleanToNumber,
      from_number: tFrom,
      status: "queued",
      vapi_call_id: vapiData.id ?? null,
    });

    return new Response(JSON.stringify({ ok: true, callId: td.sid, vapiCallId: vapiData.id, platform: "vapi+twilio" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("vapi-place-call failed", e);
    return new Response(JSON.stringify({ ok: false, error: e.message || "Could not place call" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
