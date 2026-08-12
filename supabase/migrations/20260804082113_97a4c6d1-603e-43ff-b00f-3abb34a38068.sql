-- 1. Competition tables: keep public read, restrict all writes to authenticated users
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'athletes','current_match','judge_requests','judge_scores','judge_status',
    'match_events','match_results','sessions','tournaments'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_select', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t || '_public_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
      t || '_auth_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      t || '_auth_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
      t || '_auth_delete', t);

    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- 2. Storage: match_clips stays publicly downloadable via the public bucket endpoint,
--    but object listing and all writes now require an authenticated user.
DROP POLICY IF EXISTS "match_clips_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "match_clips_public_update" ON storage.objects;
DROP POLICY IF EXISTS "match_clips_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "match_clips_public_select" ON storage.objects;
DROP POLICY IF EXISTS "match_clips_public_read" ON storage.objects;

CREATE POLICY "match_clips_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'match_clips');
CREATE POLICY "match_clips_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL);
CREATE POLICY "match_clips_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL);
CREATE POLICY "match_clips_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL);

-- 3. Realtime channel authorization: only signed-in users may publish.
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;

CREATE POLICY "realtime_authenticated_read" ON realtime.messages
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "realtime_authenticated_write" ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);