
CREATE TABLE public.phone_number_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number_id UUID NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id, agent_id)
);

CREATE INDEX idx_pna_user ON public.phone_number_agents(user_id);
CREATE INDEX idx_pna_phone ON public.phone_number_agents(phone_number_id);
CREATE INDEX idx_pna_agent ON public.phone_number_agents(agent_id);

ALTER TABLE public.phone_number_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pna_select_own" ON public.phone_number_agents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pna_insert_own" ON public.phone_number_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pna_update_own" ON public.phone_number_agents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pna_delete_own" ON public.phone_number_agents
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_pna_updated_at
BEFORE UPDATE ON public.phone_number_agents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
