-- Validation of a session code must work BEFORE the device is a member.
CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = _code AND s.active);
$function$;

-- Membership lookup used inside RLS policies: definer avoids RLS recursion on sessions.
CREATE OR REPLACE FUNCTION public.is_session_member(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code AND m.user_id = auth.uid()
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_session(text) TO authenticated;

-- Joining: a device may register itself for any ACTIVE session code.
DROP POLICY IF EXISTS session_members_insert_own ON public.session_members;
CREATE POLICY session_members_insert_own ON public.session_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_session(session_code));