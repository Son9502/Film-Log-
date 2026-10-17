-- Run this in Supabase SQL Editor to fix creator notifications

-- 1. Add walk_reviews to Realtime so INSERT events reach the walk creator
ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_reviews;

-- 2. Fix walk_completions policy — creators need to see completions on their own walks
--    (the old policy only let the completer see their own rows, blocking Realtime)
DROP POLICY IF EXISTS "walk_completions_select" ON public.walk_completions;
CREATE POLICY "walk_completions_select"
  ON public.walk_completions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_completions.walk_id
        AND walks.created_by_user_id = auth.uid()
    )
  );
