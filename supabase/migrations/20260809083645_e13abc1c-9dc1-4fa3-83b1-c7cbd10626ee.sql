DROP POLICY IF EXISTS sessions_auth_delete ON public.sessions;
DROP POLICY IF EXISTS sessions_auth_update ON public.sessions;

CREATE POLICY sessions_auth_delete ON public.sessions
  FOR DELETE TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false);

CREATE POLICY sessions_auth_update ON public.sessions
  FOR UPDATE TO authenticated
  USING (
    COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
    OR active = true
  )
  WITH CHECK (
    COALESCE(((auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
    OR true
  );