
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Agents
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  first_message TEXT NOT NULL,
  voice_id TEXT NOT NULL DEFAULT 'jennifer',
  voice_provider TEXT NOT NULL DEFAULT '11labs',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  model_provider TEXT NOT NULL DEFAULT 'openai',
  temperature NUMERIC NOT NULL DEFAULT 0.7,
  language TEXT NOT NULL DEFAULT 'en',
  vapi_assistant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_select_own" ON public.agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agents_insert_own" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agents_update_own" ON public.agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "agents_delete_own" ON public.agents FOR DELETE USING (auth.uid() = user_id);

-- Phone numbers
CREATE TABLE public.phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  e164 TEXT NOT NULL,
  label TEXT,
  twilio_sid TEXT,
  vapi_number_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "numbers_select_own" ON public.phone_numbers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "numbers_insert_own" ON public.phone_numbers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "numbers_update_own" ON public.phone_numbers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "numbers_delete_own" ON public.phone_numbers FOR DELETE USING (auth.uid() = user_id);

-- Calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  vapi_call_id TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound',
  to_number TEXT,
  from_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  duration_sec INT DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  transcript JSONB,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls_select_own" ON public.calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calls_insert_own" ON public.calls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "calls_update_own" ON public.calls FOR UPDATE USING (auth.uid() = user_id);
