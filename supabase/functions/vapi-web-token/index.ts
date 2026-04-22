import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vapi Web SDK accepts a public key. The user stored a single VAPI_API key —
// we expose it so the browser SDK can establish the WebRTC voice session.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const publicKey = Deno.env.get("VAPI_API") ?? Deno.env.get("VAPI_PUBLIC_KEY") ?? null;
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "VAPI_API secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
