
CREATE TABLE public.user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_topics TO authenticated;
GRANT ALL ON public.user_topics TO service_role;
ALTER TABLE public.user_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topics" ON public.user_topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_topics_user_created ON public.user_topics(user_id, created_at DESC);
