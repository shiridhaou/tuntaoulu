-- Public display screens (including anonymous device sessions that have not
-- joined a session) may read PUBLISHED results and the athletes they refer to.
GRANT SELECT ON public.match_results TO anon, authenticated;
GRANT SELECT ON public.athletes TO anon, authenticated;

DROP POLICY IF EXISTS match_results_public_select ON public.match_results;
CREATE POLICY match_results_public_select
  ON public.match_results FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS athletes_public_select_published ON public.athletes;
CREATE POLICY athletes_public_select_published
  ON public.athletes FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_results r
    WHERE r.athlete_id = athletes.id AND r.published = true
  ));

ALTER TABLE public.match_results REPLICA IDENTITY FULL;