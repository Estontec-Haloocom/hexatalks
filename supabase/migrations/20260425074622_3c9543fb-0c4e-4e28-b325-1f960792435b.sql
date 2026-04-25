CREATE TABLE public.feedback_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  feedback_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  settings_mode TEXT NOT NULL DEFAULT 'same' CHECK (settings_mode IN ('same','new')),
  trigger_type TEXT NOT NULL DEFAULT 'after_call' CHECK (trigger_type IN ('in_call','end_of_call','after_call')),
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  question TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fba_user ON public.feedback_agents(user_id);
CREATE INDEX idx_fba_source ON public.feedback_agents(source_agent_id);

ALTER TABLE public.feedback_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fba_select_own" ON public.feedback_agents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fba_insert_own" ON public.feedback_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fba_update_own" ON public.feedback_agents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fba_delete_own" ON public.feedback_agents
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_fba_updated_at
BEFORE UPDATE ON public.feedback_agents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();