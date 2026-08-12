CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_session ON public.match_events(session_code, created_at DESC);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_all_select" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "match_events_all_insert" ON public.match_events FOR INSERT WITH CHECK (true);
CREATE POLICY "match_events_all_update" ON public.match_events FOR UPDATE USING (true);
CREATE POLICY "match_events_all_delete" ON public.match_events FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.judge_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  judge_slot TEXT NOT NULL,
  athlete_id UUID,
  state TEXT NOT NULL DEFAULT 'judging',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_code, judge_slot)
);

ALTER TABLE public.judge_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "judge_status_all_select" ON public.judge_status FOR SELECT USING (true);
CREATE POLICY "judge_status_all_insert" ON public.judge_status FOR INSERT WITH CHECK (true);
CREATE POLICY "judge_status_all_update" ON public.judge_status FOR UPDATE USING (true);
CREATE POLICY "judge_status_all_delete" ON public.judge_status FOR DELETE USING (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_status;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.athletes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;