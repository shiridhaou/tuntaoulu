
-- 1) Private schema for internal helpers (not exposed through the API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_real_user()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

CREATE OR REPLACE FUNCTION private.is_active_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = _code AND s.active);
$$;

CREATE OR REPLACE FUNCTION private.is_session_member(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.can_write_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT private.is_real_user() OR private.is_session_member(_code);
$$;

-- Only chief referee / technical assistant style roles may manage final results
CREATE OR REPLACE FUNCTION private.can_manage_results(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_real_user() OR EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code
      AND m.user_id = auth.uid()
      AND (m.role ILIKE 'chief%' OR m.role ILIKE 'technical%' OR m.role = 'TA')
  );
$$;

-- A judge may only touch rows belonging to their own assigned slot
CREATE OR REPLACE FUNCTION private.owns_judge_slot(_code text, _slot text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.can_manage_results(_code) OR EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code
      AND m.user_id = auth.uid()
      AND m.slot = _slot
  );
$$;

CREATE OR REPLACE FUNCTION private.get_public_report(_athlete_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

GRANT EXECUTE ON FUNCTION private.is_real_user(), private.is_active_session(text),
  private.is_session_member(text), private.can_write_session(text),
  private.can_manage_results(text), private.owns_judge_slot(text, text),
  private.get_public_report(uuid) TO anon, authenticated, service_role;

-- 2) Drop policies that depend on the old public helpers
DROP POLICY IF EXISTS athletes_member_select ON public.athletes;
DROP POLICY IF EXISTS athletes_write_insert ON public.athletes;
DROP POLICY IF EXISTS athletes_write_update ON public.athletes;
DROP POLICY IF EXISTS athletes_write_delete ON public.athletes;
DROP POLICY IF EXISTS current_match_member_select ON public.current_match;
DROP POLICY IF EXISTS current_match_write_insert ON public.current_match;
DROP POLICY IF EXISTS current_match_write_update ON public.current_match;
DROP POLICY IF EXISTS current_match_write_delete ON public.current_match;
DROP POLICY IF EXISTS judge_requests_member_select ON public.judge_requests;
DROP POLICY IF EXISTS judge_requests_write_insert ON public.judge_requests;
DROP POLICY IF EXISTS judge_requests_write_update ON public.judge_requests;
DROP POLICY IF EXISTS judge_requests_write_delete ON public.judge_requests;
DROP POLICY IF EXISTS judge_scores_member_select ON public.judge_scores;
DROP POLICY IF EXISTS judge_scores_write_insert ON public.judge_scores;
DROP POLICY IF EXISTS judge_scores_write_update ON public.judge_scores;
DROP POLICY IF EXISTS judge_scores_write_delete ON public.judge_scores;
DROP POLICY IF EXISTS judge_status_member_select ON public.judge_status;
DROP POLICY IF EXISTS judge_status_write_insert ON public.judge_status;
DROP POLICY IF EXISTS judge_status_write_update ON public.judge_status;
DROP POLICY IF EXISTS judge_status_write_delete ON public.judge_status;
DROP POLICY IF EXISTS match_events_member_select ON public.match_events;
DROP POLICY IF EXISTS match_events_write_insert ON public.match_events;
DROP POLICY IF EXISTS match_events_write_update ON public.match_events;
DROP POLICY IF EXISTS match_events_write_delete ON public.match_events;
DROP POLICY IF EXISTS match_results_member_select ON public.match_results;
DROP POLICY IF EXISTS match_results_write_insert ON public.match_results;
DROP POLICY IF EXISTS match_results_write_update ON public.match_results;
DROP POLICY IF EXISTS match_results_write_delete ON public.match_results;
DROP POLICY IF EXISTS sessions_member_select ON public.sessions;
DROP POLICY IF EXISTS sessions_auth_update ON public.sessions;
DROP POLICY IF EXISTS sessions_auth_delete ON public.sessions;
DROP POLICY IF EXISTS tournaments_member_select ON public.tournaments;
DROP POLICY IF EXISTS tournaments_auth_update ON public.tournaments;
DROP POLICY IF EXISTS tournaments_auth_delete ON public.tournaments;
DROP POLICY IF EXISTS session_members_insert_own ON public.session_members;

-- 3) Remove the publicly exposed SECURITY DEFINER helpers
DROP FUNCTION IF EXISTS public.can_write_session(text);
DROP FUNCTION IF EXISTS public.is_session_member(text);
DROP FUNCTION IF EXISTS public.is_real_user();
DROP FUNCTION IF EXISTS public.is_active_session(text);
DROP FUNCTION IF EXISTS public.get_public_report(uuid);

-- 4) Thin SECURITY INVOKER wrappers for the two client-called RPCs
CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.is_active_session(_code);
$$;

CREATE OR REPLACE FUNCTION public.get_public_report(_athlete_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.get_public_report(_athlete_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_active_session(text), public.get_public_report(uuid)
  TO anon, authenticated, service_role;

-- 5) Recreate policies against the private helpers
CREATE POLICY athletes_member_select ON public.athletes FOR SELECT TO authenticated
USING (private.is_real_user() OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = athletes.tournament_id AND private.is_session_member(t.session_code)));
CREATE POLICY athletes_write_insert ON public.athletes FOR INSERT TO authenticated
WITH CHECK (private.is_real_user() OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = athletes.tournament_id AND private.is_session_member(t.session_code)));
CREATE POLICY athletes_write_update ON public.athletes FOR UPDATE TO authenticated
USING (private.is_real_user() OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = athletes.tournament_id AND private.is_session_member(t.session_code)))
WITH CHECK (private.is_real_user() OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = athletes.tournament_id AND private.is_session_member(t.session_code)));
CREATE POLICY athletes_write_delete ON public.athletes FOR DELETE TO authenticated
USING (private.is_real_user() OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = athletes.tournament_id AND private.is_session_member(t.session_code)));

CREATE POLICY current_match_member_select ON public.current_match FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY current_match_write_insert ON public.current_match FOR INSERT TO authenticated WITH CHECK (private.can_write_session(session_code));
CREATE POLICY current_match_write_update ON public.current_match FOR UPDATE TO authenticated USING (private.can_write_session(session_code)) WITH CHECK (private.can_write_session(session_code));
CREATE POLICY current_match_write_delete ON public.current_match FOR DELETE TO authenticated USING (private.can_write_session(session_code));

CREATE POLICY judge_requests_member_select ON public.judge_requests FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY judge_requests_write_insert ON public.judge_requests FOR INSERT TO authenticated WITH CHECK (private.can_write_session(session_code));
CREATE POLICY judge_requests_write_update ON public.judge_requests FOR UPDATE TO authenticated USING (private.can_write_session(session_code)) WITH CHECK (private.can_write_session(session_code));
CREATE POLICY judge_requests_write_delete ON public.judge_requests FOR DELETE TO authenticated USING (private.can_write_session(session_code));

-- judge_scores: writes are limited to the caller's own judging slot
CREATE POLICY judge_scores_member_select ON public.judge_scores FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY judge_scores_write_insert ON public.judge_scores FOR INSERT TO authenticated
WITH CHECK (private.can_write_session(session_code) AND private.owns_judge_slot(session_code, judge_slot));
CREATE POLICY judge_scores_write_update ON public.judge_scores FOR UPDATE TO authenticated
USING (private.can_write_session(session_code) AND private.owns_judge_slot(session_code, judge_slot))
WITH CHECK (private.can_write_session(session_code) AND private.owns_judge_slot(session_code, judge_slot));
CREATE POLICY judge_scores_write_delete ON public.judge_scores FOR DELETE TO authenticated
USING (private.can_write_session(session_code) AND private.owns_judge_slot(session_code, judge_slot));

CREATE POLICY judge_status_member_select ON public.judge_status FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY judge_status_write_insert ON public.judge_status FOR INSERT TO authenticated WITH CHECK (private.can_write_session(session_code));
CREATE POLICY judge_status_write_update ON public.judge_status FOR UPDATE TO authenticated USING (private.can_write_session(session_code)) WITH CHECK (private.can_write_session(session_code));
CREATE POLICY judge_status_write_delete ON public.judge_status FOR DELETE TO authenticated USING (private.can_write_session(session_code));

CREATE POLICY match_events_member_select ON public.match_events FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY match_events_write_insert ON public.match_events FOR INSERT TO authenticated WITH CHECK (private.can_write_session(session_code));
CREATE POLICY match_events_write_update ON public.match_events FOR UPDATE TO authenticated USING (private.is_real_user()) WITH CHECK (private.is_real_user());
CREATE POLICY match_events_write_delete ON public.match_events FOR DELETE TO authenticated USING (private.can_write_session(session_code));

-- match_results: only chief referee / technical assistant / signed-in organizers may write
CREATE POLICY match_results_member_select ON public.match_results FOR SELECT TO authenticated USING (private.can_write_session(session_code));
CREATE POLICY match_results_write_insert ON public.match_results FOR INSERT TO authenticated WITH CHECK (private.can_manage_results(session_code));
CREATE POLICY match_results_write_update ON public.match_results FOR UPDATE TO authenticated USING (private.can_manage_results(session_code)) WITH CHECK (private.can_manage_results(session_code));
CREATE POLICY match_results_write_delete ON public.match_results FOR DELETE TO authenticated USING (private.can_manage_results(session_code));

CREATE POLICY sessions_member_select ON public.sessions FOR SELECT TO authenticated USING (private.is_real_user() OR private.is_session_member(code));
CREATE POLICY sessions_auth_update ON public.sessions FOR UPDATE TO authenticated USING (private.is_real_user() OR private.is_session_member(code)) WITH CHECK (private.is_real_user() OR private.is_session_member(code));
CREATE POLICY sessions_auth_delete ON public.sessions FOR DELETE TO authenticated USING (private.is_real_user());

CREATE POLICY tournaments_member_select ON public.tournaments FOR SELECT TO authenticated USING (private.is_real_user() OR private.is_session_member(session_code));
CREATE POLICY tournaments_auth_update ON public.tournaments FOR UPDATE TO authenticated USING (private.is_real_user() OR (private.is_session_member(session_code) AND private.is_active_session(session_code))) WITH CHECK (private.is_real_user() OR (private.is_session_member(session_code) AND private.is_active_session(session_code)));
CREATE POLICY tournaments_auth_delete ON public.tournaments FOR DELETE TO authenticated USING (private.is_real_user() OR (private.is_session_member(session_code) AND private.is_active_session(session_code)));

CREATE POLICY session_members_insert_own ON public.session_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.is_active_session(session_code));
