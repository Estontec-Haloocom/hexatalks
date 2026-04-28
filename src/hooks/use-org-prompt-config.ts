import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

export type OrgPromptFormat = "json" | "python" | "javascript" | "markdown" | "text";

export type OrgPromptConfig = {
  id?: string;
  enabled: boolean;
  format: OrgPromptFormat;
  content: string;
};

const DEFAULT_CONFIG: OrgPromptConfig = {
  enabled: true,
  format: "json",
  content: "",
};

export const useOrgPromptConfig = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const [config, setConfig] = useState<OrgPromptConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user || !currentOrgId) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("org_prompt_configs" as any)
      .select("id,enabled,format,content")
      .eq("org_id", currentOrgId)
      .maybeSingle();

    if (!data) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }
    setConfig({
      id: data.id,
      enabled: Boolean(data.enabled),
      format: (data.format as OrgPromptFormat) || "json",
      content: data.content ?? "",
    });
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentOrgId]);

  const save = async (next: OrgPromptConfig) => {
    if (!user || !currentOrgId) return;
    await supabase.from("org_prompt_configs" as any).upsert(
      {
        org_id: currentOrgId,
        user_id: user.id,
        enabled: next.enabled,
        format: next.format,
        content: next.content,
      },
      { onConflict: "org_id" },
    );
    setConfig(next);
  };

  return { config, setConfig, save, loading, refresh };
};
