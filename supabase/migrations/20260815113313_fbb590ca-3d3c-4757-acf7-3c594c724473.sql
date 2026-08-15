-- 1. Lock down public.is_active_session: signed-in callers only, with in-function auth check
CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = upper(trim(_code)) AND s.active);
$function$;

REVOKE ALL ON FUNCTION public.is_active_session(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO authenticated, service_role;

-- 2. match_events update policy aligned with the other policies
DROP POLICY IF EXISTS match_events_write_update ON public.match_events;
CREATE POLICY match_events_write_update ON public.match_events
  FOR UPDATE TO authenticated
  USING (private.can_write_session(session_code))
  WITH CHECK (private.can_write_session(session_code));

-- 3. tournaments insert must be scoped to an active session the user belongs to
DROP POLICY IF EXISTS tournaments_auth_insert ON public.tournaments;
CREATE POLICY tournaments_auth_insert ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_real_user()
    OR (session_code IS NOT NULL
        AND private.is_session_member(session_code)
        AND private.is_active_session(session_code))
  );

-- 4. session_members: restrict which roles/slots a user can self-assign
CREATE OR REPLACE FUNCTION private.session_role_claimable(_code text, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _role IS NULL THEN true
    WHEN lower(_role) NOT IN ('chief','technical-assistant','ta','judge','judge-a','judge-b','judge-c','var','display','spectator') THEN false
    WHEN lower(_role) IN ('chief','technical-assistant','ta') THEN NOT EXISTS (
      SELECT 1 FROM public.session_members m
      WHERE m.session_code = _code
        AND lower(m.role) = lower(_role)
        AND m.user_id <> auth.uid()
    )
    ELSE true
  END;
$function$;

REVOKE ALL ON FUNCTION private.session_role_claimable(text, text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS session_members_insert_own ON public.session_members;
CREATE POLICY session_members_insert_own ON public.session_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_active_session(session_code)
    AND private.session_role_claimable(session_code, role)
  );

DROP POLICY IF EXISTS session_members_update_own ON public.session_members;
CREATE POLICY session_members_update_own ON public.session_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND private.session_role_claimable(session_code, role)
  );
