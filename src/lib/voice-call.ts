import { supabase } from "@/integrations/supabase/client";
import Vapi from "@vapi-ai/web";
import { UltravoxSession } from "ultravox-client";
import { buildEnhancedSystemPrompt, type OrgPromptConfigForBuild, type PromptBlock } from "@/hooks/use-prompt-blocks";
import type { VoicePlatform } from "@/hooks/use-dev-settings";

const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

// Fallback map for legacy agents that still have Vapi-friendly voice ids
// stored when the user switches to Ultravox.
const ULTRAVOX_FALLBACK_MAP: Record<string, string> = {
  jennifer: "Jessica",
  sarah: "Jessica",
  ava: "Tanya-English",
  ryan: "Mark",
  mark: "Mark",
  leo: "Mark",
};
const ULTRAVOX_DEFAULT_VOICE = "Mark";
const QUALITY_GUARDRAILS = `## Reliability Rules
- Never invent facts, names, prices, policies, or availability.
- If information is missing or unclear, ask a brief clarifying question before proceeding.
- Repeat back critical details (name, phone, date/time, quantity) and get confirmation.
- Keep responses short, human, and conversational unless user asks for more detail.
- If uncertain, explicitly say you are not sure and offer the next best action.`;

export type CallController = {
  stop: () => void;
  on: (
    event: "status" | "volume" | "transcript" | "error",
    handler: (payload: any) => void,
  ) => void;
};

type Listeners = Record<string, ((p: any) => void) | undefined>;

export type AgentLike = {
  id?: string;
  name: string;
  first_message: string;
  system_prompt: string;
  voice_id: string;
  voice_provider: string;
  language: string;
  model?: string;
  temperature?: number;
};

export const startWebCall = (
  platform: VoicePlatform,
  agent: AgentLike,
  blocks: PromptBlock[],
  overrides?: { systemPromptOverride?: string; firstMessageOverride?: string; orgPromptConfig?: OrgPromptConfigForBuild | null; devSettings?: any },
): CallController => {
  const listeners: Listeners = {};
  const missedEvents: { event: string; payload: any }[] = [];
  
  const emit = (event: string, payload: any) => {
    if (listeners[event]) {
      listeners[event]?.(payload);
    } else {
      missedEvents.push({ event, payload });
    }
  };

  let isStopped = false;
  let activeSessionOrVapi: any = null;

  const stop = () => {
    isStopped = true;
    try { activeSessionOrVapi?.stop?.(); } catch { /* noop */ }
    try { activeSessionOrVapi?.leaveCall?.(); } catch { /* noop */ }
  };

  const init = async () => {
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { throw new Error("Microphone permission denied. Allow mic access and try again."); }
    if (isStopped) return;

    const baseSystem = overrides?.systemPromptOverride ?? agent.system_prompt;
    const systemPrompt = [buildEnhancedSystemPrompt(baseSystem, blocks, agent.language, overrides?.orgPromptConfig), QUALITY_GUARDRAILS]
      .filter(Boolean)
      .join("\n\n");
    const firstMessage = overrides?.firstMessageOverride ?? agent.first_message;

    const actualPlatform = agent.voice_provider === "ultravox" ? "ultravox" : 
                           (agent.voice_provider && agent.voice_provider !== "11labs" && agent.voice_provider !== "playht" && agent.voice_provider !== "azure" && agent.voice_provider !== "deepgram" && agent.voice_provider !== "openai") 
                           ? platform : platform;

    const routeToUltravox = actualPlatform === "ultravox" || agent.voice_provider === "ultravox";
    const devSettings = overrides?.devSettings;
    const useCustomKeys = devSettings?.dev_mode_enabled;

    if (routeToUltravox) {
      const isUltravoxVoice = agent.voice_provider === "ultravox";
      const uvVoice = isUltravoxVoice
        ? agent.voice_id
        : ULTRAVOX_FALLBACK_MAP[agent.voice_id?.toLowerCase?.()] ?? ULTRAVOX_DEFAULT_VOICE;
      
      const { data, error } = await supabase.functions.invoke("ultravox-create-call", {
        body: {
          systemPrompt: `${firstMessage ? `# Greeting\nStart by saying: "${firstMessage}"\n\n` : ""}${systemPrompt}`,
          voice: uvVoice,
          languageHint: (agent.language || "en-US").split("-")[0].toLowerCase(),
          temperature: Number(agent.temperature ?? 0.25),
          agentId: agent.id,
          ultravox_api_key: useCustomKeys ? devSettings?.ultravox_api_key : undefined,
        },
      });
      if (error) throw error;
      if (!data?.joinUrl) throw new Error(data?.error || "Ultravox did not return a join URL");
      if (isStopped) return;

      const session = new UltravoxSession();
      activeSessionOrVapi = session;
      session.addEventListener("status", () => {
        const s = (session as any).status;
        if (s === "connecting") emit("status", "connecting");
        else if (s === "idle" || s === "disconnected") emit("status", "ended");
        else if (s) emit("status", "active");
      });
      session.addEventListener("transcripts", () => {
        const ts = (session as any).transcripts ?? [];
        const last = ts[ts.length - 1];
        if (last?.isFinal) {
          emit("transcript", { role: last.speaker === "user" ? "user" : "assistant", text: last.text });
        }
      });
      (session as any).joinCall?.(data.joinUrl);

    } else {
      let publicKey = useCustomKeys ? devSettings?.vapi_public_key : null;

      if (!publicKey) {
        const { data, error } = await supabase.functions.invoke("vapi-web-token", {
          body: {
            vapi_private_key: useCustomKeys ? devSettings?.vapi_private_key : undefined,
          }
        });
        if (error) throw error;
        if (!data?.publicKey) throw new Error(data?.error || "Voice service not configured.");
        publicKey = data.publicKey;
      }
      if (isStopped) return;

      const vapi = new Vapi(publicKey!);
      activeSessionOrVapi = vapi;
      vapi.on("call-start", () => emit("status", "active"));
      vapi.on("call-end", () => { emit("status", "ended"); emit("volume", 0); });
      vapi.on("volume-level", (v: number) => emit("volume", v));
      vapi.on("message", (m: any) => {
        if (m.type === "transcript" && m.transcriptType === "final") {
          emit("transcript", { role: m.role === "user" ? "user" : "assistant", text: m.transcript });
        }
      });
      vapi.on("error", (e: any) => emit("error", e));

      const isFallbackName = Object.prototype.hasOwnProperty.call(VOICE_MAP, agent.voice_id);
      const voiceId = isFallbackName ? VOICE_MAP[agent.voice_id] : agent.voice_id;
      const voiceProvider = agent.voice_provider || "11labs";
      const fullLang = agent.language || "en-US";
      
      // Nova-2-general only supports specific languages, fallback to "multi" if not strictly supported or if we can't be sure
      const validNovaLangs = ["bg", "ca", "zh", "zh-CN", "zh-HK", "zh-Hans", "zh-TW", "zh-Hant", "cs", "da", "da-DK", "nl", "en", "en-US", "en-AU", "en-GB", "en-NZ", "en-IN", "et", "fi", "nl-BE", "fr", "fr-CA", "de", "de-CH", "el", "hi", "hu", "id", "it", "ja", "ko", "ko-KR", "lv", "lt", "ms", "multi", "no", "pl", "pt", "pt-BR", "ro", "ru", "sk", "es", "es-419", "sv", "sv-SE", "th", "th-TH", "tr", "uk", "vi"];
      
      let langShort = fullLang;
      if (!validNovaLangs.includes(langShort)) {
         langShort = fullLang.split("-")[0].toLowerCase();
         if (!validNovaLangs.includes(langShort)) {
            langShort = "multi";
         }
      }

      emit("status", "connecting");
      
      const vapiVoiceConfig: any = voiceProvider === "vapi" 
        ? { voiceId: voiceId } 
        : { provider: voiceProvider, voiceId: voiceId };

      if (voiceProvider === "11labs" && !voiceId.includes("vapi")) {
        vapiVoiceConfig.model = "eleven_multilingual_v2";
        vapiVoiceConfig.optimizeStreamingLatency = 3;
        vapiVoiceConfig.stability = 0.45;
        vapiVoiceConfig.similarityBoost = 0.8;
        vapiVoiceConfig.style = 0.15;
        vapiVoiceConfig.useSpeakerBoost = true;
      }

      vapi.start({
        name: agent.name,
        firstMessage,
        model: {
          provider: "openai",
          model: agent.model || "gpt-4o-mini",
          temperature: Number(agent.temperature ?? 0.2),
          maxTokens: 140,
          messages: [{ role: "system", content: systemPrompt }],
        },
        voice: vapiVoiceConfig,
        transcriber: { provider: "deepgram", model: "nova-2-general", language: langShort, smartFormat: true, endpointing: 140 },
        startSpeakingPlan: { waitSeconds: 0.15, smartEndpointingEnabled: true },
        stopSpeakingPlan: { numWords: 1, voiceSeconds: 0.12, backoffSeconds: 0.5 },
        backgroundDenoisingEnabled: true,
        silenceTimeoutSeconds: 20,
        responseDelaySeconds: 0.05,
      } as any).catch((e: any) => { if (!isStopped) emit("error", e); });
    }
  };

  init().catch(e => { if (!isStopped) emit("error", e); });

  return {
    stop,
    on: (event, handler) => {
      listeners[event] = handler;
      const toFlush = missedEvents.filter(e => e.event === event);
      toFlush.forEach(e => handler(e.payload));
      for (let i = missedEvents.length - 1; i >= 0; i--) {
        if (missedEvents[i].event === event) missedEvents.splice(i, 1);
      }
    },
  };
};
