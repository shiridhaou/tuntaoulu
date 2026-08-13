
-- 1) Public report helper (published results only, no birth_date)
CREATE OR REPLACE FUNCTION public.get_public_report(_athlete_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT * FROM public.match_results
    WHERE athlete_id = _athlete_id AND published = true
    ORDER BY updated_at DESC LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM r) THEN NULL::jsonb ELSE jsonb_build_object(
    'result', (SELECT to_jsonb(r) - 'id' FROM r),
    'athlete', (SELECT jsonb_build_object('full_name', a.full_name, 'country', a.country,
        'club', a.club, 'age_category', a.age_category, 'bib_number', a.bib_number, 'style', a.style)
      FROM public.athletes a WHERE a.id = _athlete_id),
    'judge_scores', COALESCE((SELECT jsonb_agg(jsonb_build_object('judge_slot', js.judge_slot,
        'judge_role', js.judge_role, 'score', js.score, 'payload', js.payload))
      FROM public.judge_scores js, r WHERE js.session_code = r.session_code AND js.athlete_id = _athlete_id), '[]'::jsonb)
  ) END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_report(uuid) TO anon, authenticated;

-- 2) Replace blanket public SELECT policies with session-scoped ones
DROP POLICY IF EXISTS sessions_public_select ON public.sessions;
CREATE POLICY sessions_member_select ON public.sessions FOR SELECT TO authenticated
  USING (public.is_real_user() OR public.is_session_member(code));

DROP POLICY IF EXISTS tournaments_public_select ON public.tournaments;
CREATE POLICY tournaments_member_select ON public.tournaments FOR SELECT TO authenticated
  USING (public.is_real_user() OR public.is_session_member(session_code));

DROP POLICY IF EXISTS athletes_public_select ON public.athletes;
CREATE POLICY athletes_member_select ON public.athletes FOR SELECT TO authenticated
  USING (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));

DROP POLICY IF EXISTS current_match_public_select ON public.current_match;
CREATE POLICY current_match_member_select ON public.current_match FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS match_events_public_select ON public.match_events;
CREATE POLICY match_events_member_select ON public.match_events FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS judge_status_public_select ON public.judge_status;
CREATE POLICY judge_status_member_select ON public.judge_status FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS judge_scores_public_select ON public.judge_scores;
CREATE POLICY judge_scores_member_select ON public.judge_scores FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS match_results_public_select ON public.match_results;
CREATE POLICY match_results_member_select ON public.match_results FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS judge_requests_public_select ON public.judge_requests;
CREATE POLICY judge_requests_member_select ON public.judge_requests FOR SELECT TO authenticated
  USING (public.can_write_session(session_code));

-- 3) No anonymous (logged-out) role access remains on these tables
REVOKE ALL ON public.sessions, public.tournaments, public.athletes, public.current_match,
  public.match_events, public.judge_status, public.judge_scores, public.match_results,
  public.judge_requests FROM anon;

-- 4) Tournament writes: session members only, and only while the session is active
DROP POLICY IF EXISTS tournaments_auth_update ON public.tournaments;
CREATE POLICY tournaments_auth_update ON public.tournaments FOR UPDATE TO authenticated
  USING (public.is_real_user() OR (public.is_session_member(session_code) AND public.is_active_session(session_code)))
  WITH CHECK (public.is_real_user() OR (public.is_session_member(session_code) AND public.is_active_session(session_code)));

DROP POLICY IF EXISTS tournaments_auth_delete ON public.tournaments;
CREATE POLICY tournaments_auth_delete ON public.tournaments FOR DELETE TO authenticated
  USING (public.is_real_user() OR (public.is_session_member(session_code) AND public.is_active_session(session_code)));
