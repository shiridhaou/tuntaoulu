-- 1. Membership table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text,
  slot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_members TO authenticated;
GRANT ALL ON public.session_members TO service_role;

ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_members_select_own ON public.session_members;
CREATE POLICY session_members_select_own ON public.session_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS session_members_insert_own ON public.session_members;
CREATE POLICY session_members_insert_own ON public.session_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = session_code AND s.active)
  );

DROP POLICY IF EXISTS session_members_update_own ON public.session_members;
CREATE POLICY session_members_update_own ON public.session_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS session_members_delete_own ON public.session_members;
CREATE POLICY session_members_delete_own ON public.session_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_session_members_updated ON public.session_members;
CREATE TRIGGER trg_session_members_updated BEFORE UPDATE ON public.session_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper functions: SECURITY INVOKER, locked down -------------------------
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
    SELECT 1
    FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_session(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_real_user() OR public.is_session_member(_code);
$$;

REVOKE ALL ON FUNCTION public.is_real_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_session(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_session_member(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_session(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_real_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_session_member(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_session(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- 3. Athletes: membership-scoped writes --------------------------------------
DROP POLICY IF EXISTS athletes_write_insert ON public.athletes;
CREATE POLICY athletes_write_insert ON public.athletes FOR INSERT TO authenticated
  WITH CHECK (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));

DROP POLICY IF EXISTS athletes_write_update ON public.athletes;
CREATE POLICY athletes_write_update ON public.athletes FOR UPDATE TO authenticated
  USING (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)))
  WITH CHECK (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));

DROP POLICY IF EXISTS athletes_write_delete ON public.athletes;
CREATE POLICY athletes_write_delete ON public.athletes FOR DELETE TO authenticated
  USING (public.is_real_user() OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = athletes.tournament_id AND public.is_session_member(t.session_code)));

-- 4. current_match ------------------------------------------------------------
DROP POLICY IF EXISTS current_match_write_insert ON public.current_match;
CREATE POLICY current_match_write_insert ON public.current_match FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));

DROP POLICY IF EXISTS current_match_write_update ON public.current_match;
CREATE POLICY current_match_write_update ON public.current_match FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));

DROP POLICY IF EXISTS current_match_write_delete ON public.current_match;
CREATE POLICY current_match_write_delete ON public.current_match FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

-- 5. judge_requests / judge_scores / judge_status / match_events --------------
DROP POLICY IF EXISTS judge_requests_write_insert ON public.judge_requests;
CREATE POLICY judge_requests_write_insert ON public.judge_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_requests_write_update ON public.judge_requests;
CREATE POLICY judge_requests_write_update ON public.judge_requests FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_requests_write_delete ON public.judge_requests;
CREATE POLICY judge_requests_write_delete ON public.judge_requests FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS judge_scores_write_insert ON public.judge_scores;
CREATE POLICY judge_scores_write_insert ON public.judge_scores FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_scores_write_update ON public.judge_scores;
CREATE POLICY judge_scores_write_update ON public.judge_scores FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_scores_write_delete ON public.judge_scores;
CREATE POLICY judge_scores_write_delete ON public.judge_scores FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS judge_status_write_insert ON public.judge_status;
CREATE POLICY judge_status_write_insert ON public.judge_status FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_status_write_update ON public.judge_status;
CREATE POLICY judge_status_write_update ON public.judge_status FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS judge_status_write_delete ON public.judge_status;
CREATE POLICY judge_status_write_delete ON public.judge_status FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

DROP POLICY IF EXISTS match_events_write_insert ON public.match_events;
CREATE POLICY match_events_write_insert ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS match_events_write_update ON public.match_events;
CREATE POLICY match_events_write_update ON public.match_events FOR UPDATE TO authenticated
  USING (public.is_real_user()) WITH CHECK (public.is_real_user());
DROP POLICY IF EXISTS match_events_write_delete ON public.match_events;
CREATE POLICY match_events_write_delete ON public.match_events FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

-- 6. match_results -------------------------------------------------------------
DROP POLICY IF EXISTS match_results_write_insert ON public.match_results;
CREATE POLICY match_results_write_insert ON public.match_results FOR INSERT TO authenticated
  WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS match_results_write_update ON public.match_results;
CREATE POLICY match_results_write_update ON public.match_results FOR UPDATE TO authenticated
  USING (public.can_write_session(session_code)) WITH CHECK (public.can_write_session(session_code));
DROP POLICY IF EXISTS match_results_write_delete ON public.match_results;
CREATE POLICY match_results_write_delete ON public.match_results FOR DELETE TO authenticated
  USING (public.can_write_session(session_code));

-- 7. sessions: remove tautological update rule ---------------------------------
DROP POLICY IF EXISTS sessions_auth_update ON public.sessions;
CREATE POLICY sessions_auth_update ON public.sessions FOR UPDATE TO authenticated
  USING (public.is_real_user() OR public.is_session_member(code))
  WITH CHECK (public.is_real_user() OR public.is_session_member(code));

-- 8. tournaments: membership-scoped instead of active-session-scoped -----------
DROP POLICY IF EXISTS tournaments_auth_update ON public.tournaments;
CREATE POLICY tournaments_auth_update ON public.tournaments FOR UPDATE TO authenticated
  USING (public.is_real_user() OR public.is_session_member(session_code))
  WITH CHECK (public.is_real_user() OR public.is_session_member(session_code));

-- 9. Storage: match_clips ------------------------------------------------------
DROP POLICY IF EXISTS match_clips_auth_insert ON storage.objects;
CREATE POLICY match_clips_auth_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match_clips' AND (
    public.is_real_user()
    OR EXISTS (SELECT 1 FROM public.session_members m
               JOIN public.sessions s ON s.code = m.session_code AND s.active
               WHERE m.user_id = auth.uid())));

DROP POLICY IF EXISTS match_clips_auth_select ON storage.objects;
CREATE POLICY match_clips_auth_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'match_clips' AND (
    public.is_real_user()
    OR EXISTS (SELECT 1 FROM public.session_members m
               JOIN public.sessions s ON s.code = m.session_code AND s.active
               WHERE m.user_id = auth.uid())));
