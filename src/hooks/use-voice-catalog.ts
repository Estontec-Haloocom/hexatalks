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
  { id: "ta-IN", label: "Tamil" },
  { id: "te-IN", label: "Telugu" },
  { id: "kn-IN", label: "Kannada" },
  { id: "ml-IN", label: "Malayalam" },
  { id: "ar-SA", label: "Arabic" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "pt-BR", label: "Portuguese" },
];

const FALLBACK_ULTRAVOX_VOICES: VoiceOption[] = [
  { id: "Mark", label: "Mark", description: "Calm, clear · English", provider: "ultravox", language: "en", gender: "Male", accent: "American" },
  { id: "Jessica", label: "Jessica", description: "Warm, friendly · English", provider: "ultravox", language: "en", gender: "Female", accent: "American" },
  { id: "Tanya-English", label: "Tanya", description: "Bright, youthful · English", provider: "ultravox", language: "en", gender: "Female", accent: "Indian" },
  { id: "Aaron-English", label: "Aaron", description: "Deep, confident · English", provider: "ultravox", language: "en", gender: "Male", accent: "American" },
];

const FALLBACK_VAPI_VOICES: VoiceOption[] = [
  { id: "jennifer", label: "Jennifer", description: "Default assistant voice", provider: "11labs", language: "en-US", gender: "Female", accent: "American" },
  { id: "rachel", label: "Rachel", description: "Natural conversational voice", provider: "11labs", language: "en-US", gender: "Female", accent: "American" },
  { id: "adam", label: "Adam", description: "Clear and confident voice", provider: "11labs", language: "en-US", gender: "Male", accent: "American" },
];

const fetchVapi = async (settings?: any): Promise<CatalogResponse> => {
  const { data, error } = await supabase.functions.invoke("vapi-web-token", { 
    body: { 
      action: "config",
      vapi_private_key: settings?.dev_mode_enabled ? settings?.vapi_private_key : undefined
    } 
  });
  if (error) return { voices: [], languages: [], warning: "Voice library config failed" };
  return {
    voices: Array.isArray(data?.voices) ? data.voices : [],
    languages: Array.isArray(data?.languages) ? data.languages : [],
    warning: data?.warning,
  };
};

const fetchUltravox = async (): Promise<CatalogResponse> => {
  const { data, error } = await supabase.functions.invoke("ultravox-voices", { body: {} });
  if (error) return { voices: [], languages: [], warning: "Voice library config failed" };
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
 * Implements a robust local-first caching architecture so that
 * on reload, voices appear instantly without waiting for network requests.
 */
export const useVoiceCatalog = () => {
  const { settings } = useDevSettings();
  const platform: VoicePlatform = settings.voice_platform;
  const devOn = settings.dev_mode_enabled;

  const CACHE_KEY = `voice-catalog-${devOn ? platform : "all"}`;

  return useQuery({
    queryKey: [CACHE_KEY, settings?.vapi_private_key],
    initialData: () => {
      // Instant load from localStorage
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.voices) && parsed.voices.length > 0) {
            // Ensure fallback languages (like Arabic) are always present even in old cache
            parsed.languages = dedupeBy([...(parsed.languages || []), ...FALLBACK_LANGS], (l) => l.id);
            return parsed as CatalogResponse;
          }
        }
      } catch (e) {
        console.error("Failed to parse cached voice catalog", e);
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 60, // 1 hour (don't refetch on every tiny mount)
    queryFn: async (): Promise<CatalogResponse> => {
      let finalRes: CatalogResponse;
      if (devOn) {
        const res = platform === "ultravox" ? await fetchUltravox() : await fetchVapi(settings);
        const fallbackVoices = platform === "ultravox" ? FALLBACK_ULTRAVOX_VOICES : FALLBACK_VAPI_VOICES;
        finalRes = {
          voices: res.voices.length ? res.voices : fallbackVoices,
          languages: res.languages.length ? res.languages : FALLBACK_LANGS,
          warning:
            res.warning ||
            (!res.voices.length
              ? `Selected voice platform returned no voices. Showing fallback list.`
              : undefined),
        };
      } else {
        const [vapi, uv] = await Promise.all([fetchVapi(settings), fetchUltravox()]);
        const voices = dedupeBy(
          [...vapi.voices, ...uv.voices, ...FALLBACK_VAPI_VOICES, ...FALLBACK_ULTRAVOX_VOICES],
          (v) => `${v.provider}:${v.id}`,
        );
        const languages = dedupeBy([...vapi.languages, ...uv.languages, ...FALLBACK_LANGS], (l) => l.id);
        const warnings = [vapi.warning, uv.warning].filter(Boolean).join(" | ");
        finalRes = { voices, languages, warning: warnings || undefined };
      }

      // Save successful network response to robust local cache
      if (finalRes && finalRes.voices.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(finalRes));
        } catch (e) {
          console.warn("Failed to cache voice catalog", e);
        }
      }

      return finalRes;
    },
  });
};
