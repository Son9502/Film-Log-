-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the walks tables and sets up RLS policies.

-- ── 1. Create tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.walks (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  city              TEXT,
  tags              TEXT,           -- JSON array stored as string
  estimated_minutes INT,
  distance_km       FLOAT,
  difficulty        TEXT,
  is_public         BOOLEAN NOT NULL DEFAULT false,
  is_featured       BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_count  INT NOT NULL DEFAULT 0,
  avg_rating        FLOAT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.walk_stops (
  id             TEXT PRIMARY KEY,
  walk_id        TEXT NOT NULL REFERENCES public.walks(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_index    INT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  location_label TEXT,
  latitude       FLOAT,
  longitude      FLOAT
);

CREATE TABLE IF NOT EXISTS public.walk_completions (
  id           TEXT PRIMARY KEY,
  walk_id      TEXT NOT NULL REFERENCES public.walks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(walk_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.walk_reviews (
  id         TEXT PRIMARY KEY,
  walk_id    TEXT NOT NULL REFERENCES public.walks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(walk_id, user_id)
);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.walks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_stops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_reviews     ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS policies — walks ───────────────────────────────────────────────────

-- Anyone authenticated can read public walks (+ the creator can always read their own)
CREATE POLICY "walks_select"
  ON public.walks FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = created_by_user_id);

-- Only the creator can insert / update / delete their own walk
CREATE POLICY "walks_insert"
  ON public.walks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "walks_update"
  ON public.walks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "walks_delete"
  ON public.walks FOR DELETE TO authenticated
  USING (auth.uid() = created_by_user_id);

-- ── 4. RLS policies — walk_stops ─────────────────────────────────────────────

CREATE POLICY "walk_stops_select"
  ON public.walk_stops FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id
        AND (walks.is_public = true OR walks.created_by_user_id = auth.uid())
    )
  );

CREATE POLICY "walk_stops_insert"
  ON public.walk_stops FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "walk_stops_update"
  ON public.walk_stops FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "walk_stops_delete"
  ON public.walk_stops FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── 5. RLS policies — walk_completions ───────────────────────────────────────

CREATE POLICY "walk_completions_select"
  ON public.walk_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "walk_completions_insert"
  ON public.walk_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "walk_completions_delete"
  ON public.walk_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── 6. RLS policies — walk_reviews ───────────────────────────────────────────

CREATE POLICY "walk_reviews_select"
  ON public.walk_reviews FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_reviews.walk_id
        AND walks.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "walk_reviews_insert"
  ON public.walk_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "walk_reviews_update"
  ON public.walk_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "walk_reviews_delete"
  ON public.walk_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── 7. Enable Realtime on walk_completions (for creator notifications) ────────
-- Run this separately if the above succeeds:

ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_completions;

-- ── 8. Helper RPCs ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_walk_completion(walk_id TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.walks
  SET completion_count = completion_count + 1
  WHERE id = walk_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_walk_completion(walk_id TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.walks
  SET completion_count = GREATEST(0, completion_count - 1)
  WHERE id = walk_id;
$$;

CREATE OR REPLACE FUNCTION public.refresh_walk_avg_rating(walk_id TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.walks
  SET avg_rating = (
    SELECT AVG(rating)::FLOAT FROM public.walk_reviews
    WHERE walk_reviews.walk_id = walks.id
  )
  WHERE id = walk_id;
$$;
