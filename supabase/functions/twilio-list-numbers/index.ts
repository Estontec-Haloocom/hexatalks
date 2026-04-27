import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !token) throw new Error("Twilio credentials not configured");

    const auth = "Basic " + btoa(`${sid}:${token}`);
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=100`,
      { headers: { Authorization: auth } },
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data?.message || "Twilio API error");

    const numbers = (data.incoming_phone_numbers ?? []).map((n: any) => ({
      sid: n.sid,
      e164: n.phone_number,
      label: n.friendly_name,
      capabilities: n.capabilities,
    }));

    return new Response(JSON.stringify({ numbers, defaultFrom: Deno.env.get("TWILIO_PHONE_NUMBER") ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});