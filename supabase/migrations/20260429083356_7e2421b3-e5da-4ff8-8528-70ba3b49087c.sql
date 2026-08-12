ALTER TABLE public.athletes
ADD COLUMN IF NOT EXISTS difficulty_sheet jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_athletes_difficulty_sheet
ON public.athletes USING gin (difficulty_sheet);