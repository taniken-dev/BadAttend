ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
