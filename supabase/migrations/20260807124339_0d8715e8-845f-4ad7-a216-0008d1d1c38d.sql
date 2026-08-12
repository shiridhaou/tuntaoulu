DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tournaments','sessions','athletes','current_match','judge_requests','judge_scores','judge_status','match_events','match_results']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;