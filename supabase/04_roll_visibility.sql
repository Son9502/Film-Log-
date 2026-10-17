-- Content Visibility: Public / Private toggles for Rolls and Journals
-- Run in Supabase Dashboard → SQL Editor after the main schema is set up.

-- ── Rolls ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Allow any authenticated user to read rolls where is_public = true.
-- The existing user_id-scoped SELECT policy (if any) remains for private rolls.
DROP POLICY IF EXISTS "rolls_public_read" ON public.rolls;
CREATE POLICY "rolls_public_read"
  ON public.rolls FOR SELECT TO authenticated
  USING (is_public = true);

-- Allow reading shots that belong to a public roll.
DROP POLICY IF EXISTS "shots_public_read" ON public.shots;
CREATE POLICY "shots_public_read"
  ON public.shots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rolls r
      WHERE r.id = shots.roll_id AND r.is_public = true
    )
  );

-- ── Location journals ─────────────────────────────────────────────────────────
-- NOTE: create the location_journals table first (README → Supabase Setup),
-- then re-run the lines below.
--
-- ALTER TABLE public.location_journals
--   ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
--
-- DROP POLICY IF EXISTS "journals_public_read" ON public.location_journals;
-- CREATE POLICY "journals_public_read"
--   ON public.location_journals FOR SELECT TO authenticated
--   USING (is_public = true);
