
-- Helper: is the caller a real (non-anonymous) account?
CREATE OR REPLACE FUNCTION public.is_real_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Helper: does this session code belong to a currently active session?
CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = _code AND s.active);
$$;

-- Helper: caller may write data for this session code
CREATE OR REPLACE FUNCTION public.can_write_session(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.is_real_user() OR public.is_active_session(_code));
$$;

GRANT EXECUTE ON FUNCTION public.is_real_user() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_write_session(text) TO authenticated, anon;

-- ATHLETES ---------------------------------------------------------------
DROP POLICY IF EXISTS athletes_auth_insert ON public.athletes;
DROP POLICY IF EXISTS athletes_auth_update ON public.athletes;
DROP POLICY IF EXISTS athletes_auth_delete ON public.athletes;

CREATE POLICY athletes_write_insert ON public.athletes FOR INSERT TO authenticated
WITH CHECK (
  public.is_real_user()
  OR EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.id = athletes.tournament_id
               AND public.is_active_session(t.session_code))
);

CREATE POLICY athletes_write_update ON public.athletes FOR UPDATE TO authenticated
USING (
  public.is_real_user()
  OR EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.id = athletes.tournament_id
               AND public.is_active_session(t.session_code))
)
WITH CHECK (
  public.is_real_user()
  OR EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.id = athletes.tournament_id
               AND public.is_active_session(t.session_code))
);

CREATE POLICY athletes_write_delete ON public.athletes FOR DELETE TO authenticated
USING (
  public.is_real_user()
  OR EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.id = athletes.tournament_id
               AND public.is_active_session(t.session_code))
);

-- CURRENT MATCH ----------------------------------------------------------
DROP POLICY IF EXISTS current_match_auth_insert ON public.current_match;
DROP POLICY IF EXISTS current_match_auth_update ON public.current_match;
DROP POLICY IF EXISTS current_match_auth_delete ON public.current_match;

CREATE POLICY current_match_write_insert ON public.current_match FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY current_match_write_update ON public.current_match FOR UPDATE TO authenticated
USING (public.can_write_session(session_code))
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY current_match_write_delete ON public.current_match FOR DELETE TO authenticated
USING (public.is_real_user());

-- JUDGE REQUESTS ---------------------------------------------------------
DROP POLICY IF EXISTS judge_requests_auth_insert ON public.judge_requests;
DROP POLICY IF EXISTS judge_requests_auth_update ON public.judge_requests;
DROP POLICY IF EXISTS judge_requests_auth_delete ON public.judge_requests;

CREATE POLICY judge_requests_write_insert ON public.judge_requests FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_requests_write_update ON public.judge_requests FOR UPDATE TO authenticated
USING (public.can_write_session(session_code))
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_requests_write_delete ON public.judge_requests FOR DELETE TO authenticated
USING (public.can_write_session(session_code));

-- JUDGE SCORES -----------------------------------------------------------
DROP POLICY IF EXISTS judge_scores_auth_insert ON public.judge_scores;
DROP POLICY IF EXISTS judge_scores_auth_update ON public.judge_scores;
DROP POLICY IF EXISTS judge_scores_auth_delete ON public.judge_scores;

CREATE POLICY judge_scores_write_insert ON public.judge_scores FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_scores_write_update ON public.judge_scores FOR UPDATE TO authenticated
USING (public.can_write_session(session_code))
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_scores_write_delete ON public.judge_scores FOR DELETE TO authenticated
USING (public.can_write_session(session_code));

-- JUDGE STATUS -----------------------------------------------------------
DROP POLICY IF EXISTS judge_status_auth_insert ON public.judge_status;
DROP POLICY IF EXISTS judge_status_auth_update ON public.judge_status;
DROP POLICY IF EXISTS judge_status_auth_delete ON public.judge_status;

CREATE POLICY judge_status_write_insert ON public.judge_status FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_status_write_update ON public.judge_status FOR UPDATE TO authenticated
USING (public.can_write_session(session_code))
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY judge_status_write_delete ON public.judge_status FOR DELETE TO authenticated
USING (public.can_write_session(session_code));

-- MATCH EVENTS -----------------------------------------------------------
DROP POLICY IF EXISTS match_events_auth_insert ON public.match_events;
DROP POLICY IF EXISTS match_events_auth_update ON public.match_events;
DROP POLICY IF EXISTS match_events_auth_delete ON public.match_events;

CREATE POLICY match_events_write_insert ON public.match_events FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_events_write_update ON public.match_events FOR UPDATE TO authenticated
USING (public.is_real_user())
WITH CHECK (public.is_real_user());
CREATE POLICY match_events_write_delete ON public.match_events FOR DELETE TO authenticated
USING (public.is_real_user());

-- MATCH RESULTS ----------------------------------------------------------
DROP POLICY IF EXISTS match_results_auth_insert ON public.match_results;
DROP POLICY IF EXISTS match_results_auth_update ON public.match_results;
DROP POLICY IF EXISTS match_results_auth_delete ON public.match_results;

CREATE POLICY match_results_write_insert ON public.match_results FOR INSERT TO authenticated
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_results_write_update ON public.match_results FOR UPDATE TO authenticated
USING (public.can_write_session(session_code))
WITH CHECK (public.can_write_session(session_code));
CREATE POLICY match_results_write_delete ON public.match_results FOR DELETE TO authenticated
USING (public.is_real_user());
