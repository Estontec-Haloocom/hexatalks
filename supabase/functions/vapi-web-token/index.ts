import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const publicKey = Deno.env.get("VAPI_PUBLIC_KEY") ?? null;
  return new Response(JSON.stringify({ publicKey }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});