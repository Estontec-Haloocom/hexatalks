

# Hexatalks — Voice AI Agent Platform

A clean, Linear-style web app where users pick an industry, configure a voice agent in minutes, talk to it live in the browser, and trigger real outbound phone calls. Powered by **Vapi** under the hood with **Lovable AI** generating the system prompts from user intent.

## What you'll be able to do

1. Land on a premium marketing page → click "Build your agent"
2. Sign up / log in (Lovable Cloud auth)
3. Pick an industry template (Healthcare, Real Estate, Restaurants, E-commerce)
4. Describe your business in plain English → AI auto-writes the agent's system prompt, first message, and goals
5. Pick a voice, language, and LLM model
6. **Talk to the agent live in your browser** via Vapi Web SDK (mic-based)
7. Buy/attach a Twilio number and **launch a real outbound call** to any phone
8. Review call history with transcripts, recordings, duration, and cost

## Information architecture

```text
/                          Marketing landing
/auth                      Sign in / sign up
/app                       Dashboard shell (sidebar layout)
  /app                     → Overview (agent count, calls today, minutes used)
  /app/agents              List of agents
  /app/agents/new          Industry picker → builder wizard
  /app/agents/:id          Agent detail (4 tabs)
       • Configure  – name, prompt, first message, voice, model, temperature
       • Test       – live in-browser voice orb (Vapi Web SDK)
       • Phone      – attach Twilio number, place outbound call
       • Calls      – history, transcripts, recordings
  /app/phone-numbers       Manage Twilio numbers
  /app/settings            Profile, API keys (Vapi, Twilio), billing
```

## Page-by-page UX

**Landing (`/`)** — Hero with animated voice waveform, "The voice AI platform for every industry" headline, industry cards (Healthcare/Real Estate/Restaurants/E-commerce), feature grid (Build in 60s · Talk in browser · Real phone calls · Transcripts), pricing teaser, footer. Sticky transparent nav, CTA "Start free".

**Builder wizard (`/app/agents/new`)** — 4-step progress bar at top:
1. **Industry** — 4 large cards with icons; selection sets template defaults
2. **Describe** — single textarea: "Tell us about your business and what this agent should do." → AI generates prompt + first message + suggested goals (shown editable)
3. **Voice & model** — voice picker (samples playable), language, LLM model dropdown, temperature slider
4. **Review & create** — summary card + "Create agent" button

**Agent detail / Test tab** — Big centered animated orb that pulses with mic input/output volume (uses Vapi `volumeLevel` events). Status pill: Idle / Connecting / Listening / Speaking. Live transcript panel on the right showing user vs assistant turns. Big "Start call" / "End call" button.

**Agent detail / Phone tab** — Select attached number, enter destination phone (E.164), optional dynamic variables, "Place call" button → toast with call ID → live status updates.

**Calls tab** — Table: time · direction · duration · cost · status · ▶ play recording · transcript modal.

## Design system (Linear-style premium light)

- Background `0 0% 100%`, surface `220 14% 98%`, border `220 13% 91%`
- Foreground `222 47% 11%`, muted `215 16% 47%`
- Primary `222 47% 11%` (near-black), accent `262 83% 58%` (subtle violet for highlights, links, voice orb glow)
- Success `142 71% 45%`, destructive stays as-is
- Radius `0.75rem`, soft shadows (`shadow-sm` / `shadow-md`), generous whitespace
- Type: Inter for UI, "Geist" or "Inter Display" for headings via Google Fonts; tight letter-spacing on H1/H2
- Motion: framer-motion fades + 200ms transitions; voice orb uses scale + blur driven by volume
- All colors as HSL tokens in `index.css`; tailwind config extended with `accent-violet`, `surface`, `success`

## Technical architecture

```text
React + Vite + Tailwind + shadcn
        │
        ├── Lovable Cloud (Supabase)
        │     • Auth (email/password)
        │     • Tables: profiles, agents, phone_numbers, calls
        │     • RLS: owner-only access; user_roles table for future admin
        │
        ├── Edge Functions (Deno)
        │     • generate-agent-config   → Lovable AI (gemini-3-flash) writes prompt
        │     • vapi-create-assistant   → POST Vapi /assistant
        │     • vapi-update-assistant   → PATCH Vapi /assistant/:id
        │     • vapi-web-token          → returns Vapi public key for browser SDK
        │     • vapi-place-call         → POST Vapi /call (uses attached number)
        │     • vapi-webhook            → receives end-of-call-report → stores transcript/recording/cost
        │     • twilio-buy-number       → via Twilio connector gateway
        │
        └── Browser
              • @vapi-ai/web SDK for live mic conversation
              • SSE/poll edge functions for call status
```

**Database tables**

- `agents` (id, user_id, name, industry, system_prompt, first_message, voice_id, model, temperature, vapi_assistant_id, created_at)
- `phone_numbers` (id, user_id, e164, twilio_sid, vapi_number_id)
- `calls` (id, user_id, agent_id, direction, to_number, from_number, status, duration_sec, cost_usd, transcript jsonb, recording_url, created_at)
- All with RLS `user_id = auth.uid()`

**Secrets needed (added via add_secret when implementing)**
- `VAPI_PRIVATE_KEY` — server-side calls to Vapi API
- `VAPI_PUBLIC_KEY` — returned to browser for Web SDK
- Twilio — added via standard connector

**Industry templates** seeded in code as JSON — each provides a starter prompt, first message, suggested voice, and 3 example goals the AI refines based on the user's description.

## Build order (when you approve)

1. Set up Lovable Cloud + auth + design tokens + landing page
2. Dashboard shell with sidebar, agents list, empty state
3. Builder wizard + `generate-agent-config` edge function (Lovable AI)
4. Vapi integration: create assistant + Test tab live voice orb
5. Twilio connector + phone numbers page + outbound call
6. Calls history + Vapi webhook for transcripts/recordings
7. Settings, polish, responsive QA

