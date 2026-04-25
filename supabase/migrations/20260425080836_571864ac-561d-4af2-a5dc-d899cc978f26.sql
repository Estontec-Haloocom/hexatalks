-- Per-user developer settings
CREATE TABLE public.dev_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  voice_platform TEXT NOT NULL DEFAULT 'vapi',
  dev_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dev_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_settings_select_own" ON public.dev_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dev_settings_insert_own" ON public.dev_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dev_settings_update_own" ON public.dev_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dev_settings_delete_own" ON public.dev_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER dev_settings_touch_updated_at
  BEFORE UPDATE ON public.dev_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Free-form prompt blocks
CREATE TABLE public.prompt_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prompt_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_blocks_select_own" ON public.prompt_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prompt_blocks_insert_own" ON public.prompt_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompt_blocks_update_own" ON public.prompt_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "prompt_blocks_delete_own" ON public.prompt_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER prompt_blocks_touch_updated_at
  BEFORE UPDATE ON public.prompt_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX prompt_blocks_user_position_idx ON public.prompt_blocks (user_id, position);