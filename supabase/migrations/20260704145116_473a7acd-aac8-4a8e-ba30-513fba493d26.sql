
CREATE TABLE public.debates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  for_arguments TEXT,
  against_arguments TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debates TO authenticated;
GRANT ALL ON public.debates TO service_role;
ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own debates" ON public.debates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX debates_user_created_idx ON public.debates(user_id, created_at DESC);
