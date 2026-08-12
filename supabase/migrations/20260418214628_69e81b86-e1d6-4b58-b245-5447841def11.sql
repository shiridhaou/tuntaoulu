-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT false,
  session_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournaments_all_select" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_all_insert" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "tournaments_all_update" ON public.tournaments FOR UPDATE USING (true);
CREATE POLICY "tournaments_all_delete" ON public.tournaments FOR DELETE USING (true);

CREATE TRIGGER trg_tournaments_updated
BEFORE UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Athletes table
CREATE TABLE public.athletes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  bib_number TEXT,
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  age_category TEXT,
  club TEXT,
  country TEXT,
  style TEXT,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | judging | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athletes_all_select" ON public.athletes FOR SELECT USING (true);
CREATE POLICY "athletes_all_insert" ON public.athletes FOR INSERT WITH CHECK (true);
CREATE POLICY "athletes_all_update" ON public.athletes FOR UPDATE USING (true);
CREATE POLICY "athletes_all_delete" ON public.athletes FOR DELETE USING (true);

CREATE TRIGGER trg_athletes_updated
BEFORE UPDATE ON public.athletes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_athletes_tournament ON public.athletes(tournament_id);
CREATE INDEX idx_athletes_status ON public.athletes(status);

-- Current match pointer (one active athlete per session)
CREATE TABLE public.current_match (
  session_code TEXT NOT NULL PRIMARY KEY,
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.current_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY "current_match_all_select" ON public.current_match FOR SELECT USING (true);
CREATE POLICY "current_match_all_insert" ON public.current_match FOR INSERT WITH CHECK (true);
CREATE POLICY "current_match_all_update" ON public.current_match FOR UPDATE USING (true);
CREATE POLICY "current_match_all_delete" ON public.current_match FOR DELETE USING (true);

CREATE TRIGGER trg_current_match_updated
BEFORE UPDATE ON public.current_match
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.athletes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_match;