import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: "Outbound calling not configured yet. Add Vapi & Twilio integrations in Settings." }), {
    status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});