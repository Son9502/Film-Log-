# Film Log

A mobile-first app for film photographers to track rolls, log individual exposures, manage gear, and import scans — with cloud sync across devices via Supabase.

---

## Features

- **Roll tracking** — log every roll from purchase through development across five statuses: Stock → Shooting → At Lab → Developed → Archived
- **Frame logging** — record shutter speed, aperture, lighting condition, subject, notes, location, timestamp, flash used, filter (UV/polarizer/ND/colour), weather condition, star rating, and free-form tags per frame
- **Quick log** — tap ⚡ to instantly log a frame with GPS only; fill in the rest after developing
- **Development records** — track developer, dilution, dev time, dev temperature, push/pull stops, fixer, and Photo-Flo per roll
- **Scan attachment** — attach individual scans to frames via image picker, or bulk-import a ZIP of scans with automatic filename-to-frame assignment (reassignable before upload)
- **Film strip view** — visualise a roll as a film negative strip with brand-specific border colours, sprocket holes, and landscape 3:2 exposures; tap any frame to open it
- **GPS & location** — auto-captures GPS coordinates when logging a frame (if permitted); manual text location with geocoding (address → lat/lng); Shot Map pins all frames on a map
- **Location journals** — every unique location label becomes a journal entry: write notes about the place, browse all frames shot there in a chronological timeline; serves as a living trip report
- **Gear management** — manage cameras and film stocks; 17 stocks and 3 cameras included by default, add your own
- **Stats & badges** — overview dashboard (rolls, frames, stocks, cameras, locations); badge system for milestones and achievements
- **Cloud sync** — sign in with email to sync all data across devices via Supabase; works fully offline and syncs on login
- **Password security** — signup enforces min 8 chars, uppercase, number, and symbol with a live strength indicator; forgot/reset password flow via email link
- **Web + mobile** — runs in browser (Expo web) and on iOS/Android

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Routing | Expo Router (file-based) |
| Language | TypeScript |
| State | Zustand + AsyncStorage (offline-first) |
| Backend | Supabase (auth, PostgreSQL, storage) |
| Maps | react-native-maps |
| Location | expo-location + Nominatim (web geocoding) |
| Web zip import | fflate |
| Native zip import | react-native-zip-archive |

---

## Getting Started

### 1. Install dependencies

```bash
cd filmlog
npm install --legacy-peer-deps
```

### 2. Add Supabase credentials

Copy the example env file and fill in your project values (Supabase Dashboard → Project Settings → API):

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

`.env` is gitignored. Only use the **publishable / anon** key here: `EXPO_PUBLIC_*` values are bundled into the client, and Row Level Security is what protects the data. Never use the `service_role` key.

### 3. Run

```bash
npm run web        # browser
npm start          # Expo dev menu — press w for web, i for iOS, a for Android
```

If you change `.env`, restart with a cleared cache: `npx expo start -c`.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is structured, how offline sync works, and known limitations.

---

## Supabase Setup

Run everything below in Supabase Dashboard → SQL Editor, **in this order**:

1. **Database tables**, **RLS**, and **Storage bucket** sections below (base schema)
2. [`supabase/01_walks.sql`](supabase/01_walks.sql): walk tables, RLS, Realtime, counter RPCs
3. [`supabase/02_realtime_creator_notifications.sql`](supabase/02_realtime_creator_notifications.sql)
4. [`supabase/03_walk_edit_policies.sql`](supabase/03_walk_edit_policies.sql)
5. [`supabase/04_roll_visibility.sql`](supabase/04_roll_visibility.sql)
6. [`supabase/05_profiles_avatars.sql`](supabase/05_profiles_avatars.sql): profiles table + public `avatars` bucket

On a fresh project, skip the *Phase 8* walk block in **Migrations** and the walk policies in **RLS**: `01_walks.sql` replaces them with stricter policies. See [ARCHITECTURE.md §8](ARCHITECTURE.md#8-security-model--known-limitations).

### Database tables

```sql
create table rolls (
  id text primary key,
  user_id uuid references auth.users not null,
  name text,
  film_stock_id text not null,
  camera_id text not null,
  iso text not null,
  frame_count integer not null,
  status text not null,
  loaded_at text not null,
  lab_at text,
  developed_at text,
  notes text,
  location_label text,
  developer text,
  dilution text,
  dev_time text,
  dev_temp text,
  push_pull text,
  fixer text,
  photo_flo boolean,
  created_at text not null,
  updated_at text not null
);

create table shots (
  id text primary key,
  roll_id text references rolls not null,
  user_id uuid references auth.users not null,
  frame integer not null,
  shutter text,
  aperture text,
  lighting text,
  subject text,
  notes text,
  location_label text,
  latitude double precision,
  longitude double precision,
  scan_uri text,
  timestamp text,
  flash boolean,
  filter text,
  weather text,
  rating integer,
  tags text
);

create table cameras (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null
);

create table film_stocks (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  iso integer not null
);

create table location_journals (
  id text primary key,
  user_id uuid references auth.users not null,
  location_label text not null,
  body text,
  latitude double precision,
  longitude double precision,
  created_at text not null,
  updated_at text not null
);
```

### Migrations (if tables already exist)

```sql
-- Phase 5: frame metadata + dev details
alter table shots add column if not exists timestamp text;
alter table shots add column if not exists flash boolean;
alter table shots add column if not exists filter text;
alter table shots add column if not exists weather text;
alter table rolls add column if not exists developer text;
alter table rolls add column if not exists dilution text;
alter table rolls add column if not exists dev_time text;
alter table rolls add column if not exists dev_temp text;

-- Phase 5 additions: push/pull, fixer, Photo-Flo
alter table rolls add column if not exists push_pull text;
alter table rolls add column if not exists fixer text;
alter table rolls add column if not exists photo_flo boolean;

-- Phase 6: location journals
create table if not exists location_journals (
  id text primary key,
  user_id uuid references auth.users not null,
  location_label text not null,
  body text,
  latitude double precision,
  longitude double precision,
  created_at text not null,
  updated_at text not null
);

-- Phase 7: star ratings + tags
alter table shots add column if not exists rating integer;
alter table shots add column if not exists tags text;

-- Phase 8: photo / art walks
create table if not exists walks (
  id text primary key,
  title text not null,
  description text,
  city text,
  tags text,
  estimated_minutes integer,
  distance_km double precision,
  difficulty text,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  created_by_user_id uuid references auth.users,
  completion_count integer not null default 0,
  avg_rating double precision,
  created_at text not null,
  updated_at text not null
);

create table if not exists walk_stops (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  order_index integer not null,
  title text not null,
  description text,
  location_label text,
  latitude double precision,
  longitude double precision
);

create table if not exists walk_completions (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  completed_at text not null
);

create table if not exists walk_reviews (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  rating integer not null,
  body text,
  created_at text not null
);

-- Helper RPCs used by the app to keep denormalized counts in sync
create or replace function increment_walk_completion(walk_id text)
returns void language sql as $$
  update walks set completion_count = completion_count + 1 where id = walk_id;
$$;

create or replace function decrement_walk_completion(walk_id text)
returns void language sql as $$
  update walks set completion_count = greatest(0, completion_count - 1) where id = walk_id;
$$;

create or replace function refresh_walk_avg_rating(walk_id text)
returns void language sql as $$
  update walks set avg_rating = (
    select avg(rating)::double precision from walk_reviews where walk_reviews.walk_id = walks.id
  ) where id = walk_id;
$$;
```

### Row Level Security (RLS)

```sql
alter table rolls             enable row level security;
alter table shots             enable row level security;
alter table cameras           enable row level security;
alter table film_stocks       enable row level security;
alter table location_journals enable row level security;
alter table walks             enable row level security;
alter table walk_stops        enable row level security;
alter table walk_completions  enable row level security;
alter table walk_reviews      enable row level security;

create policy "own rows" on rolls             for all using (auth.uid() = user_id);
create policy "own rows" on shots             for all using (auth.uid() = user_id);
create policy "own rows" on cameras          for all using (auth.uid() = user_id);
create policy "own rows" on film_stocks      for all using (auth.uid() = user_id);
create policy "own rows" on location_journals for all using (auth.uid() = user_id);

-- Walks: owners can do anything; anyone can read public walks
create policy "own walks"    on walks for all    using (auth.uid() = created_by_user_id);
create policy "read public"  on walks for select using (is_public = true);
create policy "own stops"    on walk_stops for all    using (auth.uid() = user_id);
create policy "read pub stops" on walk_stops for select using (
  exists (select 1 from walks where walks.id = walk_stops.walk_id and walks.is_public = true)
);
create policy "own completions" on walk_completions for all using (auth.uid() = user_id);
create policy "own reviews"     on walk_reviews for all    using (auth.uid() = user_id);
create policy "read reviews"    on walk_reviews for select using (true);
```

### Storage bucket

1. Supabase Dashboard → Storage → New bucket
2. Name: `scans`, set to **Private**
3. Add RLS policies:

```sql
create policy "upload own scans" on storage.objects
  for insert with check (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own scans" on storage.objects
  for select using (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "delete own scans" on storage.objects
  for delete using (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

Scans are stored at `{userId}/{rollId}/{shotId}.{ext}` and served via signed URLs (1-hour expiry).

---

## Project Structure

```
filmlog/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # Rolls list (home)
│   │   ├── map.tsx             # Global map tab
│   │   ├── journal.tsx         # Location journals tab
│   │   ├── walks.tsx           # Photo walks tab (My / Community / Recommended)
│   │   └── settings.tsx        # Settings tab
│   ├── auth/
│   │   ├── login.tsx           # Sign in + forgot password
│   │   ├── signup.tsx          # Create account
│   │   └── reset-password.tsx  # Password reset (deep-linked from email)
│   ├── journal/
│   │   └── [label].tsx         # Location journal detail + frame timeline
│   ├── walks/
│   │   ├── [id].tsx            # Walk detail — stops, completion, review
│   │   └── new.tsx             # Create / edit walk with stop builder
│   ├── roll/
│   │   ├── [id].tsx            # Roll detail, frame list, scan attachment, film strip, shot map
│   │   ├── new.tsx             # New roll form
│   │   ├── import.tsx          # ZIP scan import (iOS/Android)
│   │   └── import.web.tsx      # ZIP scan import (web, uses fflate)
│   ├── profile/
│   │   └── [userId].tsx        # Public photographer profile
│   ├── settings/
│   │   ├── gear.tsx            # Camera + film stock management
│   │   ├── profile.tsx         # Edit handle, display name, bio, avatar, visibility
│   │   └── stats.tsx           # Stats dashboard + badges
│   └── _layout.tsx             # Root layout, session bootstrap, auth gate, Realtime
├── src/
│   ├── components/
│   │   └── BadgeToast.tsx      # Badge / notification toasts
│   ├── constants/              # COLORS theme, default gear, film stocks, filter/weather options, badges
│   ├── mocks/                  # Web stubs for native-only packages
│   ├── services/
│   │   └── supabase.ts         # Supabase client, auth helpers, storage helpers
│   ├── store/
│   │   └── index.ts            # Zustand store (rolls, shots, gear, journals, walks, profiles, sync)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   └── utils/
│       ├── index.ts            # uid, formatDate, rollProgress, validators
│       └── badges.ts           # Badge stats + notification engine
├── supabase/                   # Incremental SQL scripts (run in numeric order)
├── metro.config.js             # Stubs react-native-maps, zip-archive, share on web
├── .env.example                # Required environment variables
├── ARCHITECTURE.md             # System design & data flow
└── package.json
```

---

## Default Gear

### Cameras
Nikon FE · Nikon L35AD2 · Other

### Film Stocks (17 included)
Kodak Portra 160/400/800, Gold 200, ColorPlus 200, Ektar 100, UltraMax 400, Tri-X 400
Fuji Superia 400, Pro 400H, Velvia 50, Provia 100F
Ilford HP5 Plus, Delta 100, Delta 3200, FP4 Plus
Rollei RPX 400

Custom cameras and stocks can be added per-user and sync to Supabase.

---

## Roadmap

> **v1 target:** see [MVP.md](MVP.md) for what remains before the web app counts as finished (security fixes, deployment, config, and Phase 9), plus the acceptance demo.

| Phase | Status | Description |
|---|---|---|
| 1 — Core UI | ✅ Done | Rolls, frames, gear, five-status workflow, navigation |
| 2 — Auth & Sync | ✅ Done | Supabase auth, cloud sync, offline-first, forgot/reset password |
| 3 — Scans | ✅ Done | Per-frame scan attachment, ZIP bulk import, film strip view |
| 4 — GPS & Location | ✅ Done | Auto-GPS on frame log, per-roll Shot Map, manual location labels on rolls and frames, text-to-coords geocoding |
| 5 — Frame Metadata | ✅ Done | Per-frame timestamp, flash, filter (UV/polarizer/ND/colour), weather condition; development details (developer, dilution, time, temperature, push/pull, fixer, Photo-Flo); quick-log ⚡ FAB |
| 6 — Location Journals | ✅ Done | Location tab grouping all shot places; per-location notes editor; chronological frame timeline per location; full Supabase sync |
| 7 — Gamification | ✅ Done | Star ratings (1–5) and free-form tags per frame; stats dashboard with 15 metrics; badge system with 28 achievements across volume, craft, darkroom, scanning, and rating categories |
| 8 — Photo / Art Walks | ✅ Done | Curated walking routes for photographers: personal walks (private, saved to profile), community walks (public, discoverable by city), and recommended/featured walks; stop-by-stop waypoints with location description and shooting tips; completion tracking; star ratings and short reviews; Shot Map overlay showing the walk route; auto-link stops to Location Journals; 4 new walk-specific badges (First Walk, Walker ×5, Trail Blazer, Walk Critic) |
| 9 — Public Profiles | 🚧 In progress | Opt-in public photographer profile. **Done:** handle, display name, bio, avatar upload, public/private toggle, public rolls, public walks (`supabase/04`, `05`). **Remaining:** badges and stats on the profile, completed walks, curated favourite shots, full technical cards per frame |
| 10 — AI Film Advisor | 🔜 Planned | Context-aware chatbot using the user's roll history: stock recommendations, exposure guidance, home dev walkthrough, pattern analysis, troubleshooting |
| 11 — Sharing & Export | 🔜 Planned | Share journals, rolls, and shots via share sheet; optional EXIF embedding (camera, ISO, shutter, aperture, GPS, timestamp) written back into scan files before export — user toggle in Settings |
| Auth Polish | 🔜 Planned | Google/Yahoo OAuth, custom Supabase email templates |

---

## Developer Notes

- All domain types live in `src/types/index.ts` — add there first
- Store actions follow the pattern: update local state → `persist()` → background Supabase write
- Frame count reductions must go through `validateFrameCountChange()` in `src/utils/index.ts`
- Only the last logged frame can be deleted (film can't be un-exposed)
- `Alert.alert` does not work on web — use inline confirm state pattern instead
- Scan attachment is gated to rolls with status At Lab, Developed, or Archived
- `react-native-maps` and `react-native-zip-archive` are stubbed on web via `metro.config.js`
- Supabase processes password-reset tokens before React mounts on web — the reset screen uses both `getSession()` and `onAuthStateChange` in parallel to handle the race condition
- Tags stored in DB as JSON string (`text` column); parse on hydration with try/catch guard
- Badges are computed client-side from store data — no DB table required
- Supabase config is read from `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); the app throws a clear error at startup if either is missing
- New schema changes go in a new numbered file under `supabase/`
