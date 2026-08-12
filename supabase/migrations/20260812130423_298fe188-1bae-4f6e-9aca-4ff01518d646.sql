-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.judge_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  judge_name TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('A','B','C','AHJ')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','approved','rejected')),
  assigned_slot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_judge_requests_session ON public.judge_requests(session_code);
CREATE INDEX IF NOT EXISTS idx_judge_requests_status ON public.judge_requests(status);

CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT false,
  session_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.athletes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  bib_number TEXT,
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  age_category TEXT,
  club TEXT,
  country TEXT,
  style TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  difficulty_codes TEXT[] DEFAULT '{}'::text[],
  difficulty_sheet JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_athletes_tournament ON public.athletes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_athletes_status ON public.athletes(status);
CREATE INDEX IF NOT EXISTS idx_athletes_difficulty_sheet ON public.athletes USING gin (difficulty_sheet);

CREATE TABLE IF NOT EXISTS public.current_match (
  session_code TEXT NOT NULL PRIMARY KEY,
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  timer_state TEXT NOT NULL DEFAULT 'idle',
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  style TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ta_deductions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_match_events_session ON public.match_events(session_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.judge_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  judge_slot TEXT NOT NULL,
  athlete_id UUID,
  state TEXT NOT NULL DEFAULT 'judging',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_code, judge_slot)
);

CREATE TABLE IF NOT EXISTS public.judge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  athlete_id UUID,
  judge_slot TEXT NOT NULL,
  judge_role TEXT NOT NULL,
  score NUMERIC(5,3),
  payload JSONB DEFAULT '{}'::jsonb,
  submitted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_code, athlete_id, judge_slot)
);

CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  athlete_id UUID NOT NULL,
  athlete_name TEXT,
  style TEXT,
  score_a NUMERIC(5,3),
  score_b NUMERIC(5,3),
  score_c NUMERIC(5,3),
  deductions NUMERIC(5,3) DEFAULT 0,
  final_score NUMERIC(6,3) NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_code, athlete_id)
);

CREATE TABLE IF NOT EXISTS public.session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  role TEXT,
  slot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_code, user_id)
);

-- triggers
DROP TRIGGER IF EXISTS update_judge_requests_updated_at ON public.judge_requests;
CREATE TRIGGER update_judge_requests_updated_at BEFORE UPDATE ON public.judge_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_tournaments_updated ON public.tournaments;
CREATE TRIGGER trg_tournaments_updated BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_athletes_updated ON public.athletes;
CREATE TRIGGER trg_athletes_updated BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_current_match_updated ON public.current_match;
CREATE TRIGGER trg_current_match_updated BEFORE UPDATE ON public.current_match
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_judge_scores_updated ON public.judge_scores;
CREATE TRIGGER trg_judge_scores_updated BEFORE UPDATE ON public.judge_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_match_results_updated ON public.match_results;
CREATE TRIGGER trg_match_results_updated BEFORE UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_session_members_updated ON public.session_members;
CREATE TRIGGER trg_session_members_updated BEFORE UPDATE ON public.session_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper functions
CREATE OR REPLACE FUNCTION public.is_real_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = _code AND s.active);
$$;

CREATE OR REPLACE FUNCTION public.is_session_member(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_real_user() OR public.is_session_member(_code);
$$;

GRANT EXECUTE ON FUNCTION public.is_real_user() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_session_member(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_write_session(text) TO authenticated, anon;

-- RLS + grants + realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sessions','judge_requests','tournaments','athletes','current_match','match_events','judge_status','judge_scores','match_results'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_public_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_public_select', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_members TO authenticated;
GRANT ALL ON public.session_members TO service_role;
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_members_select_own ON public.session_members;
CREATE POLICY session_members_select_own ON public.session_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS session_members_insert_own ON public.session_members;
CREATE POLICY session_members_insert_own ON public.session_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = session_code AND s.active));
DROP POLICY IF EXISTS session_members_update_own ON public.session_members;
CREATE POLICY session_members_update_own ON public.session_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS session_members_delete_own ON public.session_members;
CREATE POLICY session_members_delete_own ON public.session_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- sessions write policies
CREATE POLICY sessions_auth_insert ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sessions_auth_update ON public.sessions FOR UPDATE TO authenticated
  USING (public.is_real_user() OR public.is_session_member(code))
  WITH CHECK (public.is_real_user() OR public.is_session_member(code));
CREATE POLICY sessions_auth_delete ON public.sessions FOR DELETE TO authenticated
  USING (public.is_real_user());

-- tournaments
CREATE POLICY tournaments_auth_insert ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tournaments_auth_update ON public.tournaments FOR UPDATE TO authenticated
  USING (public.is_real_user() OR public.is_session_member(session_code))
  WITH CHECK (public.is_real_user() OR public.is_session_member(session_code));
CREATE POLICY tournaments_auth_delete ON public.tournaments FOR DELETE TO authenticated
  USING (public.is_real_user());

-- athletes
CREATE POLICY athletes_write_insert ON public.athletes FOR INSERT TO authenticated
  WITH CHECK (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));
CREATE POLICY athletes_write_update ON public.athletes FOR UPDATE TO authenticated
  USING (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)))
  WITH CHECK (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));
CREATE POLICY athletes_write_delete ON public.athletes FOR DELETE TO authenticated
  USING (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));

-- session-scoped tables
CREATE POLICY current_match_write_insert ON public.current_match FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY current_match_write_update ON public.current_match FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
CREATE POLICY current_match_write_delete ON public.current_match FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

CREATE POLICY judge_requests_write_insert ON public.judge_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_requests_write_update ON public.judge_requests FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_requests_write_delete ON public.judge_requests FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

CREATE POLICY judge_scores_write_insert ON public.judge_scores FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_scores_write_update ON public.judge_scores FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_scores_write_delete ON public.judge_scores FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

CREATE POLICY judge_status_write_insert ON public.judge_status FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_status_write_update ON public.judge_status FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_status_write_delete ON public.judge_status FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

CREATE POLICY match_events_write_insert ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_events_write_update ON public.match_events FOR UPDATE TO authenticated
  USING (public.is_real_user()) WITH CHECK (public.is_real_user());
CREATE POLICY match_events_write_delete ON public.match_events FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

CREATE POLICY match_results_write_insert ON public.match_results FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_results_write_update ON public.match_results FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_results_write_delete ON public.match_results FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));