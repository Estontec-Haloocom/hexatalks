import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDevSettings, type VoicePlatform } from "@/hooks/use-dev-settings";
import type { VapiVoiceOption, VapiLanguageOption } from "@/hooks/use-vapi-config";

export type VoiceOption = VapiVoiceOption;
export type LanguageOption = VapiLanguageOption;

type CatalogResponse = {
  voices: VoiceOption[];
  languages: LanguageOption[];
  warning?: string;
};

const FALLBACK_LANGS: LanguageOption[] = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "hi-IN", label: "Hindi" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
];

const fetchVapi = async (): Promise<CatalogResponse> => {
  const { data, error } = await supabase.functions.invoke("vapi-web-token", { body: { action: "config" } });
  if (error) return { voices: [], languages: [], warning: "Vapi config failed" };
  return {
    voices: Array.isArray(data?.voices) ? data.voices : [],
    languages: Array.isArray(data?.languages) ? data.languages : [],
    warning: data?.warning,
  };
};

const fetchUltravox = async (): Promise<CatalogResponse> => {
  const { data, error } = await supabase.functions.invoke("ultravox-voices", { body: {} });
  if (error) return { voices: [], languages: [], warning: "Ultravox config failed" };
  return {
    voices: Array.isArray(data?.voices) ? data.voices : [],
    languages: Array.isArray(data?.languages) ? data.languages : [],
    warning: data?.warning,
  };
};

const dedupeBy = <T,>(arr: T[], key: (x: T) => string) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
};

/**
 * Returns voices + languages.
 * - Dev mode ON: only the platform selected in dev settings.
 * - Dev mode OFF: union of all providers so the user sees everything.
 */
export const useVoiceCatalog = () => {
  const { settings } = useDevSettings();
  const platform: VoicePlatform = settings.voice_platform;
  const devOn = settings.dev_mode_enabled;

  return useQuery({
    queryKey: ["voice-catalog", devOn ? platform : "all"],
    queryFn: async (): Promise<CatalogResponse> => {
      if (devOn) {
        const res = platform === "ultravox" ? await fetchUltravox() : await fetchVapi();
        return {
          voices: res.voices,
          languages: res.languages.length ? res.languages : FALLBACK_LANGS,
          warning: res.warning,
        };
      }
      const [vapi, uv] = await Promise.all([fetchVapi(), fetchUltravox()]);
      const voices = dedupeBy([...vapi.voices, ...uv.voices], (v) => `${v.provider}:${v.id}`);
      const languages = dedupeBy([...vapi.languages, ...uv.languages, ...FALLBACK_LANGS], (l) => l.id);
      return { voices, languages };
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
    initialData: { voices: [], languages: FALLBACK_LANGS },
  });
};