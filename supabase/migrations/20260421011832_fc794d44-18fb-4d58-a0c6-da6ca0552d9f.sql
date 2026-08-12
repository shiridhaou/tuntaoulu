-- Add timer state to current_match
ALTER TABLE public.current_match
  ADD COLUMN IF NOT EXISTS timer_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS elapsed_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS style text;

CREATE TABLE IF NOT EXISTS public.judge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  athlete_id uuid,
  judge_slot text NOT NULL,
  judge_role text NOT NULL,
  score numeric(5,3),
  payload jsonb DEFAULT '{}'::jsonb,
  submitted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, athlete_id, judge_slot)
);

ALTER TABLE public.judge_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "judge_scores_all_select" ON public.judge_scores;
DROP POLICY IF EXISTS "judge_scores_all_insert" ON public.judge_scores;
DROP POLICY IF EXISTS "judge_scores_all_update" ON public.judge_scores;
DROP POLICY IF EXISTS "judge_scores_all_delete" ON public.judge_scores;
CREATE POLICY "judge_scores_all_select" ON public.judge_scores FOR SELECT USING (true);
CREATE POLICY "judge_scores_all_insert" ON public.judge_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "judge_scores_all_update" ON public.judge_scores FOR UPDATE USING (true);
CREATE POLICY "judge_scores_all_delete" ON public.judge_scores FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  athlete_id uuid NOT NULL,
  athlete_name text,
  style text,
  score_a numeric(5,3),
  score_b numeric(5,3),
  score_c numeric(5,3),
  deductions numeric(5,3) DEFAULT 0,
  final_score numeric(6,3) NOT NULL,
  published boolean NOT NULL DEFAULT false,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, athlete_id)
);

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_results_all_select" ON public.match_results;
DROP POLICY IF EXISTS "match_results_all_insert" ON public.match_results;
DROP POLICY IF EXISTS "match_results_all_update" ON public.match_results;
DROP POLICY IF EXISTS "match_results_all_delete" ON public.match_results;
CREATE POLICY "match_results_all_select" ON public.match_results FOR SELECT USING (true);
CREATE POLICY "match_results_all_insert" ON public.match_results FOR INSERT WITH CHECK (true);
CREATE POLICY "match_results_all_update" ON public.match_results FOR UPDATE USING (true);
CREATE POLICY "match_results_all_delete" ON public.match_results FOR DELETE USING (true);

-- Add only new tables to realtime publication safely
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_scores;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

DROP TRIGGER IF EXISTS trg_judge_scores_updated ON public.judge_scores;
CREATE TRIGGER trg_judge_scores_updated BEFORE UPDATE ON public.judge_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_match_results_updated ON public.match_results;
CREATE TRIGGER trg_match_results_updated BEFORE UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();