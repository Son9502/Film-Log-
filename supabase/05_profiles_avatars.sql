-- Phase 9: Public Profiles
-- Run this in Supabase Dashboard → SQL Editor

-- ── 1. Create profiles table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle     TEXT UNIQUE NOT NULL,
  bio        TEXT,
  is_public  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- Any authenticated user can read any profile.
-- Discoverability is controlled by is_public in the app layer, not RLS,
-- so that a user can always fetch their own profile regardless of is_public.
CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Only the owner can insert, update, or delete their own profile.
CREATE POLICY "profiles_write"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Display name and avatar photo ─────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT;

-- ── 5. Avatar storage bucket ──────────────────────────────────────────────────
-- Run once; safe to re-run (ON CONFLICT DO NOTHING).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view avatars (URLs are used to render profile photos publicly).
DROP POLICY IF EXISTS "avatars_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;

CREATE POLICY "avatars_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Each user may only write inside their own folder: avatars/{userId}/...
CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
