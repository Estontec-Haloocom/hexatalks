import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDevSettings } from "./use-dev-settings";

export const useWalletBalances = () => {
  const { settings } = useDevSettings();
  const [balances, setBalances] = useState<{ vapi: number | null; ultravox: number | null }>({ vapi: 0, ultravox: 0 });
  const [loading, setLoading] = useState(false);

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.functions.invoke("vapi-web-token", {
          body: { action: "wallet", vapi_private_key: settings?.dev_mode_enabled ? settings.vapi_private_key : undefined }
        }),
        supabase.functions.invoke("ultravox-create-call", {
          body: { action: "wallet", ultravox_api_key: settings?.dev_mode_enabled ? settings.ultravox_api_key : undefined }
        })
      ]);

      const vapiRes = results[0].status === "fulfilled" ? results[0].value : null;
      const uvRes = results[1].status === "fulfilled" ? results[1].value : null;

      setBalances({
        vapi: typeof vapiRes?.data?.balance === "number" ? vapiRes.data.balance : 0,
        ultravox: typeof uvRes?.data?.balance === "number" ? uvRes.data.balance : 0
      });
    } catch (e) {
      console.error("Failed to fetch wallets", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [settings?.dev_mode_enabled, settings?.vapi_private_key, settings?.ultravox_api_key]);

  return { balances, loading, refresh: fetchBalances };
};
