ALTER TABLE public.dev_settings ADD COLUMN IF NOT EXISTS vapi_public_key TEXT;
ALTER TABLE public.dev_settings ADD COLUMN IF NOT EXISTS vapi_private_key TEXT;
ALTER TABLE public.dev_settings ADD COLUMN IF NOT EXISTS ultravox_api_key TEXT;
