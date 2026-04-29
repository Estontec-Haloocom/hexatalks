import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VoicePlatform = "vapi" | "ultravox";
export type TelephonyProvider = "twilio" | "plivo" | "exotel";

export type DevSettings = {
  voice_platform: VoicePlatform;
  dev_mode_enabled: boolean;
  telephony_provider: TelephonyProvider;
  fallback_voice_platform: VoicePlatform;
  failover_enabled: boolean;
  vapi_public_key?: string;
  vapi_private_key?: string;
  ultravox_api_key?: string;
};

const DEFAULTS: DevSettings = {
  voice_platform: "vapi",
  dev_mode_enabled: false,
  telephony_provider: "twilio",
  fallback_voice_platform: "vapi",
  failover_enabled: false,
  vapi_public_key: "",
  vapi_private_key: "",
  ultravox_api_key: "",
};

export const useDevSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DevSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setSettings(DEFAULTS); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("dev_settings")
      .select("voice_platform,dev_mode_enabled,telephony_provider,fallback_voice_platform,failover_enabled,vapi_public_key,vapi_private_key,ultravox_api_key")
      .eq("user_id", user.id)
      .maybeSingle();
    setSettings({
      voice_platform: ((data?.voice_platform as VoicePlatform) ?? "vapi"),
      dev_mode_enabled: Boolean(data?.dev_mode_enabled),
      telephony_provider: ((data?.telephony_provider as TelephonyProvider) ?? "twilio"),
      fallback_voice_platform: ((data?.fallback_voice_platform as VoicePlatform) ?? "vapi"),
      failover_enabled: Boolean(data?.failover_enabled),
      vapi_public_key: data?.vapi_public_key ?? "",
      vapi_private_key: data?.vapi_private_key ?? "",
      ultravox_api_key: data?.ultravox_api_key ?? "",
    });
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const update = async (patch: Partial<DevSettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("dev_settings").upsert(
      {
        user_id: user.id,
        voice_platform: next.voice_platform,
        dev_mode_enabled: next.dev_mode_enabled,
        telephony_provider: next.telephony_provider,
        fallback_voice_platform: next.fallback_voice_platform,
        failover_enabled: next.failover_enabled,
        vapi_public_key: next.vapi_public_key,
        vapi_private_key: next.vapi_private_key,
        ultravox_api_key: next.ultravox_api_key,
      },
      { onConflict: "user_id" },
    );
  };

  return { settings, loading, update, refresh: load };
};
