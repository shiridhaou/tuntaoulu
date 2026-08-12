ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS difficulty_codes text[] DEFAULT '{}'::text[];