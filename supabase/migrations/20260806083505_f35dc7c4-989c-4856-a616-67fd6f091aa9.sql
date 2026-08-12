DROP POLICY IF EXISTS match_clips_auth_update ON storage.objects;
DROP POLICY IF EXISTS match_clips_auth_delete ON storage.objects;

CREATE POLICY match_clips_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

CREATE POLICY match_clips_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'match_clips' AND auth.uid() IS NOT NULL AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);