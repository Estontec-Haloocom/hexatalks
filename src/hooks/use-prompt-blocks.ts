import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

export type PromptBlock = {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  position: number;
};

export const usePromptBlocks = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user || !currentOrgId) { setBlocks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("prompt_blocks")
      .select("id,name,content,enabled,position")
      .eq("org_id", currentOrgId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setBlocks((data as PromptBlock[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id, currentOrgId]);

  return { blocks, loading, refresh };
};

export const buildEnhancedSystemPrompt = (
  basePrompt: string,
  blocks: PromptBlock[],
  language?: string,
) => {
  const enabled = blocks.filter((b) => b.enabled && b.content.trim());
  const fullLang = language || "en-US";
  const langShort = fullLang.split("-")[0].toLowerCase();
  const LANG_NAMES: Record<string, string> = {
    en: "English", hi: "Hindi", es: "Spanish", fr: "French", de: "German",
    pt: "Portuguese", it: "Italian", ja: "Japanese", zh: "Mandarin Chinese",
    ar: "Arabic", ru: "Russian", nl: "Dutch", pl: "Polish", tr: "Turkish",
    ko: "Korean", id: "Indonesian", vi: "Vietnamese", th: "Thai",
  };
  const langName = LANG_NAMES[langShort] || fullLang;
  const languageDirective = `\n\n## Language\nYou MUST speak and respond ONLY in ${langName} (${fullLang}) for the entire conversation, including the very first message. Never switch to another language unless the user explicitly asks. Use natural, native phrasing.`;

  const blocksText = enabled.map((b) => `## ${b.name}\n${b.content.trim()}`).join("\n\n");
  return [basePrompt || "", blocksText, languageDirective].filter(Boolean).join("\n\n");
};