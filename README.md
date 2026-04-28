# Hexatalks AI Studio

Voice AI studio for creating, testing, and deploying agent-driven phone/web calls with Supabase, Vapi, and Ultravox.

## Environment setup

This app requires Supabase frontend env vars at build time.

1. Copy `.env.example` to `.env`.
2. Set:
   - `VITE_SUPABASE_URL`
   - One of `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
3. Never use `sb_secret_*` keys in frontend env vars.

## Deployment safety

`npm run build` now runs `scripts/validate-env.mjs` before Vite build.
If env vars are missing/invalid, build fails early with a clear error.

For Vercel, make sure the same `VITE_*` variables are set in:
Project Settings -> Environment Variables
