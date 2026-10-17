# Film Log — MVP / v1

**One line:** Film Log is a web app for film photographers that tracks every roll from purchase to archive, logs each exposure's settings and location, and attaches the developed scans to the frames they came from. It works offline and syncs through Supabase.

The original MVP (log rolls and frames, attach scans, sync to the cloud) was finished at roadmap Phase 3, and Phases 4–8 built on top of it. This document defines **v1**: the point at which the web app is secure, deployed, and presentable as a finished project. For the feature list and setup, see [README.md](README.md). For how the code is structured, see [ARCHITECTURE.md](ARCHITECTURE.md).

**Scope: web only.** The mobile apps (iOS and Android) share this codebase but are untested and come after v1.

---

## 1. Where things stand

| Area | Status |
|---|---|
| Roll tracking (five statuses: Stock → Shooting → At Lab → Developed → Archived) | ✅ Built |
| Frame logging (settings, lighting, notes, flash, filter, weather, rating, tags), quick log | ✅ Built |
| Development records (developer, dilution, time, temperature, push/pull, fixer, Photo-Flo) | ✅ Built |
| Scans: per-frame attachment, ZIP bulk import, film-strip view | ✅ Built |
| Location: GPS tagging, typed-location geocoding, shot-location view | ✅ Built (on web, the shot map is a list grouped by roll) |
| Location journals | ✅ Built |
| Badges (32), 15-metric stats dashboard, progress nudges | ✅ Built |
| Photo walks: personal and community walks, reviews, completions, creator notifications | ✅ Built |
| Auth: sign-up with password rules, sign-in, password reset; offline-first sync | ✅ Built |
| Public profiles (Phase 9) | 🟡 Partly built (see §2, Pillar E) |
| Database security review | ⚠️ Known issues (see §2, Pillar A) |
| Public deployment | ❌ Not deployed |
| Public GitHub repo | ❌ Not yet created |

---

## 2. v1 pillars

### Pillar A — Database security

Row Level Security is the only thing protecting user data, because the Supabase key is bundled into the client by design. v1 closes the known gaps listed in [ARCHITECTURE.md §8](ARCHITECTURE.md#8-security-model--known-limitations):

- **Counter functions:** any signed-in user can call `increment_walk_completion`, `decrement_walk_completion` and `refresh_walk_avg_rating`. Replace them with triggers on `walk_completions` and `walk_reviews`, so counts and ratings only change when real rows change. Revoke direct execute access to the functions.
- **Overlapping policies:** the README's original walk policies and `supabase/01_walks.sql` define the same rules under different names. Postgres combines them with OR, so the broadest one wins. For example, the README's `read reviews … using (true)` makes every review readable, even by signed-out users. Drop the README set, keep `01_walks.sql`, and update the README's setup section to match.
- **Private profiles:** profiles are readable by any signed-in user even when `is_public` is false, because the app filters them rather than the database. Add a policy so other users can only read profiles where `is_public = true`.
- **Function hardening:** add `SET search_path = public` to every `SECURITY DEFINER` function that remains.
- Write the changes as a new numbered script, `supabase/06_security_hardening.sql`.

**Done when:** a second test account cannot read a private profile, cannot change another user's walk counters, and cannot read reviews while signed out.

### Pillar B — Deployment

- Export the web build (`npx expo export --platform web`) and host it on a static host (e.g. Vercel, Netlify or Cloudflare Pages), with the two `EXPO_PUBLIC_SUPABASE_*` values set in the host's environment settings.
- Add the deployed URL to Supabase **Authentication → URL Configuration** (Site URL and Redirect URLs), so password-reset links point at the live app.
- Put the live link and a few screenshots or a short demo GIF at the top of the README.

**Done when:** a new visitor can open the public URL, sign up, log a roll and reset their password from an emailed link.

### Pillar C — Config and dependencies

- **App icon:** add the missing `assets/icon.png` (referenced in `app.json`) and a web favicon.
- **Bundle ID:** replace the placeholder `com.yourname.filmlog` in `app.json` with a real identifier. This only matters for mobile builds, but it shouldn't ship as a placeholder in a public repo.
- **Dependency versions:** `expo` is on SDK 55 while several `expo-*` and React Native packages are pinned to SDK 52-era versions, which is why installing needs `--legacy-peer-deps`. Run `npx expo install --fix`, retest on web, and remove the flag from the README.
- **Cleanup:** remove the empty `{src` and `dist` folders.

**Done when:** `npm install` works without `--legacy-peer-deps`, and the web build runs with no missing-asset warnings.

### Pillar D — Repository

- Create the GitHub repo from `filmlog/` (the repo currently initialised in `Photo App/` is in the wrong folder and has no commits).
- Add a `LICENSE` file if others should be able to reuse the code.
- Make the README's Supabase setup section match the final scripts in `supabase/`.

**Done when:** the repo is public, and a fresh clone plus the README's steps produces a working app against a new Supabase project.

### Pillar E — Public profiles (finish or defer Phase 9)

**Built:** handle, display name, bio, avatar upload, public/private toggle, public rolls, public walks, and a stats row on your own profile.

**Missing (for v1):**
- Visitors see the profile owner's stats (rolls, frames, completed walks) and earned badges. Today the stats row only appears on your own profile.
- Opening a public roll shows its frames with their technical details (camera, stock, shutter, aperture, location). Today public rolls load without their frames.

**Deferred past v1:** curated favourite shots.

**Done when:** a second account can open your public profile and see your stats, badges and a public roll's frames, and sees nothing when your profile is private.

---

## 3. v1 acceptance — the demo

v1 is done when this works on the deployed site:

1. Open the public URL and create an account (the password rules and strength meter show).
2. Create a roll of Portra 400 and log three frames. The first frame captures GPS, and the "First Frame" badge toast appears.
3. Move the roll to **Developed** and bulk-import a ZIP of three scans. The scans are assigned to frames 1–3 by filename order, one is reassigned, and all are uploaded.
4. Open the film-strip view and the shot-location view. Both show the new frames.
5. Write a location journal entry for one frame's location.
6. Create a public walk, then sign in as a second account, complete the walk and review it. The first account gets a real-time notification.
7. As the second account, open the first account's public profile and see its stats, badges and the public roll's frames.
8. Make the profile private. The second account can no longer see it.
9. Sign out, use "Forgot password", and reset the password from the emailed link on the live site.

---

## 4. Out of scope (after v1)

- **Mobile:** test and release the iOS and Android apps (native map view, native ZIP import, app-store builds).
- **Phase 10 — AI Film Advisor:** a chatbot that uses the user's roll history.
- **Phase 11 — Sharing & Export:** share sheets and optional EXIF embedding in exported scans.
- **Auth polish:** Google sign-in and custom Supabase email templates.
- **Public profiles:** curated favourite shots.
- **Code health:** split `app/roll/[id].tsx` (about 2,300 lines) into components, add automated tests, and add timestamp-based conflict resolution to sync.
