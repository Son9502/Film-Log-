-- Run this in the Supabase SQL Editor to fix walk editing for the creator.

-- 1. Add WITH CHECK to walks_update so upsert (INSERT ON CONFLICT DO UPDATE) passes RLS
DROP POLICY IF EXISTS "walks_update" ON public.walks;
CREATE POLICY "walks_update"
  ON public.walks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = created_by_user_id);

-- 2. Fix walk_stops_delete so the creator can delete stops on their own walks
--    (update flow: delete all stops for a walk, then re-insert the new set)
DROP POLICY IF EXISTS "walk_stops_delete" ON public.walk_stops;
CREATE POLICY "walk_stops_delete"
  ON public.walk_stops FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id
        AND walks.created_by_user_id = auth.uid()
    )
  );

-- 3. Same fix for walk_stops_update (just in case)
DROP POLICY IF EXISTS "walk_stops_update" ON public.walk_stops;
CREATE POLICY "walk_stops_update"
  ON public.walk_stops FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id
        AND walks.created_by_user_id = auth.uid()
    )
  );

-- 4. Allow any authenticated user to read reviews on public walks
--    (previously only the reviewer and the walk creator could read reviews)
DROP POLICY IF EXISTS "walk_reviews_select" ON public.walk_reviews;
CREATE POLICY "walk_reviews_select"
  ON public.walk_reviews FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_reviews.walk_id
        AND walks.created_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_reviews.walk_id
        AND walks.is_public = true
    )
  );
