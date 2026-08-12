-- Sessions table: chief creates a session with a code
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Judge requests: each judge submits a join request
CREATE TABLE public.judge_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  judge_name TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('A','B','C','AHJ')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','approved','rejected')),
  assigned_slot TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_judge_requests_session ON public.judge_requests(session_code);
CREATE INDEX idx_judge_requests_status ON public.judge_requests(status);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_requests ENABLE ROW LEVEL SECURITY;

-- Open policies (no auth — security via secret session code)
CREATE POLICY "sessions_all_select" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "sessions_all_insert" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_all_update" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "sessions_all_delete" ON public.sessions FOR DELETE USING (true);

CREATE POLICY "judge_requests_all_select" ON public.judge_requests FOR SELECT USING (true);
CREATE POLICY "judge_requests_all_insert" ON public.judge_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "judge_requests_all_update" ON public.judge_requests FOR UPDATE USING (true);
CREATE POLICY "judge_requests_all_delete" ON public.judge_requests FOR DELETE USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_judge_requests_updated_at
BEFORE UPDATE ON public.judge_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_requests;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.judge_requests REPLICA IDENTITY FULL;