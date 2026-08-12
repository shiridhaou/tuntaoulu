DROP POLICY IF EXISTS tournaments_auth_delete ON public.tournaments;
DROP POLICY IF EXISTS tournaments_auth_update ON public.tournaments;

CREATE POLICY tournaments_auth_delete ON public.tournaments
FOR DELETE TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY tournaments_auth_update ON public.tournaments
FOR UPDATE TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.code = tournaments.session_code AND s.active
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.code = tournaments.session_code AND s.active
  )
);