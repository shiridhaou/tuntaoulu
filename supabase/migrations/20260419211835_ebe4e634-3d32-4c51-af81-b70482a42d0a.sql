-- Create public storage bucket for verified VAR match clips
INSERT INTO storage.buckets (id, name, public)
VALUES ('match_clips', 'match_clips', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permissive policies (no auth in this app — protected by session_code semantics)
CREATE POLICY "match_clips_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'match_clips');

CREATE POLICY "match_clips_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'match_clips');

CREATE POLICY "match_clips_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'match_clips');

CREATE POLICY "match_clips_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'match_clips');