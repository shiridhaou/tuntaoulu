GRANT SELECT ON TABLE public.sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;

GRANT SELECT ON TABLE public.judge_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.judge_requests TO authenticated;
GRANT ALL ON TABLE public.judge_requests TO service_role;