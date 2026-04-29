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

export const startWebCall = async (
  platform: VoicePlatform,
  agent: AgentLike,
  blocks: PromptBlock[],
  overrides?: { systemPromptOverride?: string; firstMessageOverride?: string; orgPromptConfig?: OrgPromptConfigForBuild | null },
): Promise<CallController> => {
  const listeners: Listeners = {};
  const emit = (e: string, p: any) => listeners[e]?.(p);

  try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { throw new Error("Microphone permission denied. Allow mic access and try again."); }

  const baseSystem = overrides?.systemPromptOverride ?? agent.system_prompt;
  const systemPrompt = [buildEnhancedSystemPrompt(baseSystem, blocks, agent.language, overrides?.orgPromptConfig), QUALITY_GUARDRAILS]
    .filter(Boolean)
    .join("\n\n");
  const firstMessage = overrides?.firstMessageOverride ?? agent.first_message;

  if (platform === "ultravox") {
    // If the agent was configured with an Ultravox voice, use it directly.
    // Otherwise (legacy Vapi name) map to a sensible Ultravox equivalent.
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
      },
    });
    if (error) throw error;
    if (!data?.joinUrl) throw new Error(data?.error || "Ultravox did not return a join URL");

    const session = new UltravoxSession();
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

    return {
      stop: () => { try { (session as any).leaveCall?.(); } catch { /* noop */ } },
      on: (event, handler) => { listeners[event] = handler; },
    };
  }

  // Default: Vapi
  const { data, error } = await supabase.functions.invoke("vapi-web-token");
  if (error) throw error;
  if (!data?.publicKey) throw new Error(data?.error || "Voice service not configured.");

  const vapi = new Vapi(data.publicKey);
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
  const langShort = fullLang.split("-")[0].toLowerCase();

  emit("status", "connecting");
  
  const vapiVoiceConfig: any = {
    provider: voiceProvider,
    voiceId: voiceId
  };

  // Only append specific 11labs config if it's an actual 11labs external voice, not a custom vapi cloned voice.
  // Many Vapi specific/custom voices will fail if arbitrary 11labs config params are attached to them.
  if (voiceProvider === "11labs" && !voiceId.includes("vapi")) {
    vapiVoiceConfig.model = "eleven_multilingual_v2";
    vapiVoiceConfig.optimizeStreamingLatency = 3;
    vapiVoiceConfig.stability = 0.45;
    vapiVoiceConfig.similarityBoost = 0.8;
    vapiVoiceConfig.style = 0.15;
    vapiVoiceConfig.useSpeakerBoost = true;
  }

  await vapi.start({
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
  } as any);

  return {
    stop: () => { try { vapi.stop(); } catch { /* noop */ } },
    on: (event, handler) => { listeners[event] = handler; },
  };
};
