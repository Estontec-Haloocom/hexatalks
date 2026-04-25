import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VapiVoiceOption = {
  id: string;
  label: string;
  description: string;
  provider: string;
  language?: string;
};

export type VapiLanguageOption = {
  id: string;
  label: string;
};

type VapiConfigResponse = {
  voices: VapiVoiceOption[];
  languages: VapiLanguageOption[];
  warning?: string;
};

const fallbackVoices: VapiVoiceOption[] = [
  { id: "jennifer", label: "Jennifer", description: "Warm, professional", provider: "11labs", language: "en-US" },
  { id: "ryan", label: "Ryan", description: "Confident, clear", provider: "11labs", language: "en-US" },
  { id: "sarah", label: "Sarah", description: "Friendly, British", provider: "11labs", language: "en-GB" },
  { id: "mark", label: "Mark", description: "Calm, reassuring", provider: "11labs", language: "en-US" },
  { id: "ava", label: "Ava", description: "Bright, youthful", provider: "11labs", language: "en-US" },
  { id: "leo", label: "Leo", description: "Deep, authoritative", provider: "11labs", language: "en-US" },
];

const fallbackLanguages: VapiLanguageOption[] = [
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

export const useVapiConfig = () => {
  return useQuery({
    queryKey: ["vapi-config"],
    queryFn: async (): Promise<VapiConfigResponse> => {
      const { data, error } = await supabase.functions.invoke("vapi-web-token", {
        body: { action: "config" },
      });

      if (error) {
        console.warn("Vapi config fetch failed", error);
        return { voices: fallbackVoices, languages: fallbackLanguages, warning: "Using fallback voice options." };
      }

      return {
        voices: Array.isArray(data?.voices) && data.voices.length > 0 ? data.voices : fallbackVoices,
        languages: Array.isArray(data?.languages) && data.languages.length > 0 ? data.languages : fallbackLanguages,
        warning: typeof data?.warning === "string" ? data.warning : undefined,
      };
    },
    initialData: {
      voices: fallbackVoices,
      languages: fallbackLanguages,
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
};
