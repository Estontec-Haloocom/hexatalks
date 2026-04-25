import { supabase } from "@/integrations/supabase/client";
import Vapi from "@vapi-ai/web";
import { UltravoxSession } from "ultravox-client";
import { buildEnhancedSystemPrompt, type PromptBlock } from "@/hooks/use-prompt-blocks";
import type { VoicePlatform } from "@/hooks/use-dev-settings";

const VOICE_MAP: Record<string, string> = {
  jennifer: "21m00Tcm4TlvDq8ikWAM",
  ryan: "ErXwobaYiN019PkySvjV",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  mark: "VR6AewLTigWG4xSOukaG",
  ava: "MF3mGyEYCl7XYWbV9V6O",
  leo: "pNInz6obpgDQGcFmaJgB",
};

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
  overrides?: { systemPromptOverride?: string; firstMessageOverride?: string },
): Promise<CallController> => {
  const listeners: Listeners = {};
  const emit = (e: string, p: any) => listeners[e]?.(p);

  try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { throw new Error("Microphone permission denied. Allow mic access and try again."); }

  const baseSystem = overrides?.systemPromptOverride ?? agent.system_prompt;
  const systemPrompt = buildEnhancedSystemPrompt(baseSystem, blocks, agent.language);
  const firstMessage = overrides?.firstMessageOverride ?? agent.first_message;

  if (platform === "ultravox") {
    const { data, error } = await supabase.functions.invoke("ultravox-create-call", {
      body: {
        systemPrompt: `${firstMessage ? `# Greeting\nStart by saying: "${firstMessage}"\n\n` : ""}${systemPrompt}`,
        voice: agent.voice_id, // Ultravox accepts voice names like "Mark", "Tanya-English", etc.
        languageHint: (agent.language || "en-US").split("-")[0].toLowerCase(),
        temperature: Number(agent.temperature ?? 0.5),
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
  await vapi.start({
    name: agent.name,
    firstMessage,
    model: {
      provider: "openai",
      model: agent.model || "gpt-4o-mini",
      temperature: Number(agent.temperature ?? 0.6),
      maxTokens: 180,
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: voiceProvider,
      voiceId,
      ...(voiceProvider === "11labs" ? { model: "eleven_multilingual_v2", optimizeStreamingLatency: 3, stability: 0.45, similarityBoost: 0.8, style: 0.15, useSpeakerBoost: true } : {}),
    } as any,
    transcriber: { provider: "deepgram", model: "nova-2-general", language: langShort, smartFormat: true, endpointing: 220 },
    startSpeakingPlan: { waitSeconds: 0.3, smartEndpointingEnabled: true },
    stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.2, backoffSeconds: 1 },
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.2,
  } as any);

  return {
    stop: () => { try { vapi.stop(); } catch { /* noop */ } },
    on: (event, handler) => { listeners[event] = handler; },
  };
};