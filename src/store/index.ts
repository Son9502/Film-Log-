import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { Roll, Camera, FilmStock, User, Shot, LocationJournal, Walk, WalkStop, WalkCompletion, WalkReview, UserProfile } from "@/types";
import { DEFAULT_CAMERAS, DEFAULT_FILM_STOCKS } from "@/constants";
import { computeBadgeStats, computeBadgeNotifications, AppNotification } from "@/utils/badges";
import { uid } from "@/utils";

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEYS = {
  rolls: "filmlog:rolls",
  cameras: "filmlog:cameras",
  filmStocks: "filmlog:filmStocks",
  userId: "filmlog:userId",
  journals: "filmlog:journals",
  personalWalks: "filmlog:personalWalks",
  completions: "filmlog:completions",
  myReviews: "filmlog:myReviews",
  shownNudges: "filmlog:shownNudges",
};

// ── DB mappers (camelCase ↔ snake_case) ───────────────────────────────────────
function rollToDb(roll: Roll, userId: string) {
  return {
    id: roll.id,
    user_id: userId,
    name: roll.name ?? null,
    film_stock_id: roll.filmStockId,
    camera_id: roll.cameraId,
    iso: roll.iso,
    frame_count: roll.frameCount,
    status: roll.status,
    loaded_at: roll.loadedAt,
    lab_at: roll.labAt ?? null,
    developed_at: roll.developedAt ?? null,
    notes: roll.notes ?? null,
    location_label: roll.locationLabel ?? null,
    developer: roll.developer ?? null,
    dilution: roll.dilution ?? null,
    dev_time: roll.devTime ?? null,
    dev_temp: roll.devTemp ?? null,
    push_pull: roll.pushPull ?? null,
    fixer: roll.fixer ?? null,
    photo_flo: roll.photoFlo ?? null,
    is_public: roll.isPublic ?? false,
    created_at: roll.createdAt,
    updated_at: roll.updatedAt,
  };
}

function dbToRoll(row: any): Roll {
  return {
    id: row.id,
    name: row.name ?? undefined,
    filmStockId: row.film_stock_id,
    cameraId: row.camera_id,
    iso: row.iso,
    frameCount: row.frame_count,
    status: row.status,
    loadedAt: row.loaded_at,
    labAt: row.lab_at ?? undefined,
    developedAt: row.developed_at ?? undefined,
    notes: row.notes ?? undefined,
    locationLabel: row.location_label ?? undefined,
    shots: (row.shots ?? []).map(dbToShot),
    userId: row.user_id,
    developer: row.developer ?? undefined,
    dilution: row.dilution ?? undefined,
    devTime: row.dev_time ?? undefined,
    devTemp: row.dev_temp ?? undefined,
    pushPull: row.push_pull ?? undefined,
    fixer: row.fixer ?? undefined,
    photoFlo: row.photo_flo ?? undefined,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function shotToDb(shot: Shot, rollId: string, userId: string) {
  return {
    id: shot.id,
    roll_id: rollId,
    user_id: userId,
    frame: shot.frame,
    shutter: shot.shutter ?? null,
    aperture: shot.aperture ?? null,
    lighting: shot.lighting ?? null,
    subject: shot.subject ?? null,
    notes: shot.notes ?? null,
    scan_uri: shot.scanUri ?? null,
    location_label: shot.locationLabel ?? null,
    latitude: shot.location?.latitude ?? null,
    longitude: shot.location?.longitude ?? null,
    timestamp: shot.timestamp ?? null,
    flash: shot.flash ?? null,
    filter: shot.filter ?? null,
    weather: shot.weather ?? null,
    rating: shot.rating ?? null,
    tags: shot.tags ? JSON.stringify(shot.tags) : null,
  };
}

function dbToShot(row: any): Shot {
  return {
    id: row.id,
    frame: row.frame,
    shutter: row.shutter ?? undefined,
    aperture: row.aperture ?? undefined,
    lighting: row.lighting ?? undefined,
    subject: row.subject ?? undefined,
    notes: row.notes ?? undefined,
    locationLabel: row.location_label ?? undefined,
    scanUri: row.scan_uri ?? undefined,
    timestamp: row.timestamp ?? undefined,
    flash: row.flash ?? undefined,
    filter: row.filter ?? undefined,
    weather: row.weather ?? undefined,
    rating: row.rating ?? undefined,
    tags: (() => { try { return row.tags ? JSON.parse(row.tags) : undefined; } catch { return undefined; } })(),
    location: row.latitude != null && row.longitude != null ? {
      latitude: row.latitude,
      longitude: row.longitude,
    } : undefined,
  };
}

// ── Journal DB mappers ────────────────────────────────────────────────────────
function journalToDb(journal: LocationJournal, userId: string) {
  return {
    id: journal.id,
    user_id: userId,
    location_label: journal.locationLabel,
    body: journal.body ?? null,
    latitude: journal.latitude ?? null,
    longitude: journal.longitude ?? null,
    created_at: journal.createdAt,
    updated_at: journal.updatedAt,
  };
}

function dbToJournal(row: any): LocationJournal {
  return {
    id: row.id,
    locationLabel: row.location_label,
    body: row.body ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Walk DB mappers ───────────────────────────────────────────────────────────
function walkToDb(walk: Walk, userId: string) {
  return {
    id: walk.id,
    title: walk.title,
    description: walk.description ?? null,
    city: walk.city ?? null,
    tags: walk.tags ? JSON.stringify(walk.tags) : null,
    estimated_minutes: walk.estimatedMinutes ?? null,
    distance_km: walk.distanceKm ?? null,
    difficulty: walk.difficulty ?? null,
    is_public: walk.isPublic,
    is_featured: walk.isFeatured ?? false,
    created_by_user_id: userId,
    completion_count: walk.completionCount,
    avg_rating: walk.avgRating ?? null,
    created_at: walk.createdAt,
    updated_at: walk.updatedAt,
  };
}

function dbToWalk(row: any): Walk {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    city: row.city ?? undefined,
    tags: (() => { try { return row.tags ? JSON.parse(row.tags) : undefined; } catch { return undefined; } })(),
    estimatedMinutes: row.estimated_minutes ?? undefined,
    distanceKm: row.distance_km ?? undefined,
    difficulty: row.difficulty ?? undefined,
    isPublic: row.is_public,
    isFeatured: row.is_featured ?? undefined,
    createdByUserId: row.created_by_user_id,
    stops: (row.walk_stops ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map(dbToWalkStop),
    completionCount: row.completion_count ?? 0,
    avgRating: row.avg_rating ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function walkStopToDb(stop: WalkStop, userId: string) {
  return {
    id: stop.id,
    walk_id: stop.walkId,
    user_id: userId,
    order_index: stop.order,
    title: stop.title,
    description: stop.description ?? null,
    location_label: stop.locationLabel ?? null,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
  };
}

function dbToWalkStop(row: any): WalkStop {
  return {
    id: row.id,
    walkId: row.walk_id,
    order: row.order_index,
    title: row.title,
    description: row.description ?? undefined,
    locationLabel: row.location_label ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

function completionToDb(c: WalkCompletion) {
  return { id: c.id, walk_id: c.walkId, user_id: c.userId, completed_at: c.completedAt };
}

function dbToCompletion(row: any): WalkCompletion {
  return { id: row.id, walkId: row.walk_id, userId: row.user_id, completedAt: row.completed_at };
}

function reviewToDb(r: WalkReview) {
  return { id: r.id, walk_id: r.walkId, user_id: r.userId, rating: r.rating, body: r.body ?? null, created_at: r.createdAt };
}

function dbToReview(row: any): WalkReview {
  return { id: row.id, walkId: row.walk_id, userId: row.user_id, rating: row.rating, body: row.body ?? undefined, createdAt: row.created_at };
}

function profileToDb(p: UserProfile) {
  return {
    user_id: p.userId,
    handle: p.handle,
    display_name: p.displayName ?? null,
    bio: p.bio ?? null,
    is_public: p.isPublic,
    avatar_url: p.avatarUrl ?? null,
  };
}

function dbToProfile(row: any): UserProfile {
  return {
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name ?? undefined,
    bio: row.bio ?? undefined,
    isPublic: row.is_public,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface FilmLogState {
  rolls: Roll[];
  cameras: Camera[];
  filmStocks: FilmStock[];
  journals: LocationJournal[];
  personalWalks: Walk[];
  communityWalks: Walk[];   // memory-only, not persisted
  completions: WalkCompletion[];
  myReviews: WalkReview[];
  walkReviews: WalkReview[];   // all reviews for the currently viewed walk, memory-only
  myProfile: UserProfile | null;
  user: User | null;
  hydrated: boolean;
  notifications: AppNotification[];
  shownProgressNudges: string[];

  addRoll: (roll: Roll) => void;
  updateRoll: (roll: Roll) => void;
  deleteRoll: (id: string) => void;

  addShot: (rollId: string, shot: Shot) => void;
  updateShot: (rollId: string, shot: Shot) => void;
  deleteShot: (rollId: string, shotId: string) => void;

  addCamera: (camera: Camera) => void;
  updateCamera: (camera: Camera) => void;
  deleteCamera: (id: string) => void;
  addFilmStock: (stock: FilmStock) => void;
  updateFilmStock: (stock: FilmStock) => void;
  deleteFilmStock: (id: string) => void;

  upsertJournal: (journal: LocationJournal) => void;
  deleteJournal: (id: string) => void;

  createWalk: (walk: Walk) => void;
  updateWalk: (walk: Walk) => void;
  deleteWalk: (id: string) => void;
  fetchCommunityWalks: () => Promise<void>;
  markWalkComplete: (completion: WalkCompletion) => void;
  unmarkWalkComplete: (completionId: string) => void;
  submitReview: (review: WalkReview) => void;
  deleteReview: (reviewId: string) => void;
  fetchWalkReviews: (walkId: string) => Promise<void>;

  dismissNotification: (id: string) => void;
  subscribeToCreatorNotifications: (userId: string) => () => void;

  loadMyProfile: () => Promise<void>;
  saveProfile: (data: { handle: string; displayName?: string; bio?: string; isPublic: boolean; avatarUrl?: string }) => Promise<{ error?: string }>;
  fetchPublicProfile: (userId: string) => Promise<UserProfile | null>;

  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
  uploadLocalToSupabase: (userId: string) => Promise<void>;
  clearUserData: () => void;
  clearAllData: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useFilmLogStore = create<FilmLogState>((set, get) => ({
  rolls: [],
  cameras: DEFAULT_CAMERAS,
  filmStocks: DEFAULT_FILM_STOCKS,
  journals: [],
  personalWalks: [],
  communityWalks: [],
  completions: [],
  myReviews: [],
  walkReviews: [],
  myProfile: null,
  user: null,
  hydrated: false,
  notifications: [],
  shownProgressNudges: [],

  // ── Rolls ──────────────────────────────────────────────────────────────────
  addRoll: (roll) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ rolls: [roll, ...s.rolls] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("rolls").insert(rollToDb(roll, user.id))
        .then(({ error }) => { if (error) console.error("addRoll sync:", error); });
    }
  },

  updateRoll: (roll) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ rolls: s.rolls.map((r) => (r.id === roll.id ? roll : r)) }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("rolls").upsert(rollToDb(roll, user.id))
        .then(({ error }) => { if (error) console.error("updateRoll sync:", error); });
    }
  },

  deleteRoll: (id) => {
    set((s) => ({ rolls: s.rolls.filter((r) => r.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("rolls").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteRoll sync:", error); });
    }
  },

  // ── Shots ──────────────────────────────────────────────────────────────────
  addShot: (rollId, shot) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId ? { ...r, shots: [...r.shots, shot], updatedAt: new Date().toISOString() } : r
      ),
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges, rollId);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("shots").insert(shotToDb(shot, rollId, user.id))
        .then(({ error }) => {
          if (error) {
            console.error("addShot sync failed, will retry via uploadLocalToSupabase:", error);
            // Fallback: upsert the whole shots list so the shot isn't lost
            get().uploadLocalToSupabase(user.id);
          }
        });
    }
  },

  updateShot: (rollId, shot) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId
          ? { ...r, shots: r.shots.map((sh) => (sh.id === shot.id ? shot : sh)), updatedAt: new Date().toISOString() }
          : r
      ),
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("shots").upsert(shotToDb(shot, rollId, user.id))
        .then(({ error }) => { if (error) console.error("updateShot sync:", error); });
    }
  },

  deleteShot: (rollId, shotId) => {
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId
          ? { ...r, shots: r.shots.filter((sh) => sh.id !== shotId), updatedAt: new Date().toISOString() }
          : r
      ),
    }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("shots").delete().eq("id", shotId)
        .then(({ error }) => { if (error) console.error("deleteShot sync:", error); });
    }
  },

  // ── Gear ───────────────────────────────────────────────────────────────────
  addCamera: (camera) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ cameras: [...s.cameras, camera] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("cameras").insert({ id: camera.id, user_id: user.id, name: camera.name })
        .then(({ error }) => { if (error) console.error("addCamera sync:", error); });
    }
  },

  updateCamera: (camera) => {
    set((s) => ({ cameras: s.cameras.map((c) => (c.id === camera.id ? camera : c)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("cameras").upsert({ id: camera.id, user_id: user.id, name: camera.name })
        .then(({ error }) => { if (error) console.error("updateCamera sync:", error); });
    }
  },

  deleteCamera: (id) => {
    set((s) => ({ cameras: s.cameras.filter((c) => c.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("cameras").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteCamera sync:", error); });
    }
  },

  addFilmStock: (stock) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ filmStocks: [...s.filmStocks, stock] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("film_stocks").insert({ id: stock.id, user_id: user.id, name: stock.name, iso: stock.iso })
        .then(({ error }) => { if (error) console.error("addFilmStock sync:", error); });
    }
  },

  updateFilmStock: (stock) => {
    set((s) => ({ filmStocks: s.filmStocks.map((f) => (f.id === stock.id ? stock : f)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_stocks").upsert({ id: stock.id, user_id: user.id, name: stock.name, iso: stock.iso })
        .then(({ error }) => { if (error) console.error("updateFilmStock sync:", error); });
    }
  },

  deleteFilmStock: (id) => {
    set((s) => ({ filmStocks: s.filmStocks.filter((f) => f.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_stocks").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteFilmStock sync:", error); });
    }
  },

  // ── Journals ───────────────────────────────────────────────────────────────
  upsertJournal: (journal) => {
    const userId = get().user?.id;
    set((state) => {
      const idx = state.journals.findIndex(
        (j) => j.id === journal.id || j.locationLabel.toLowerCase() === journal.locationLabel.toLowerCase()
      );
      const journals = idx >= 0
        ? state.journals.map((j, i) => (i === idx ? journal : j))
        : [...state.journals, journal];
      if (userId) {
        supabase.from("location_journals")
          .upsert(journalToDb(journal, userId))
          .then(({ error }) => { if (error) console.error("upsertJournal sync:", error); });
      }
      return { journals };
    });
    get().persist();
  },

  deleteJournal: (id) => {
    const userId = get().user?.id;
    set((s) => ({ journals: s.journals.filter((j) => j.id !== id) }));
    get().persist();
    if (userId) {
      supabase.from("location_journals").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteJournal sync:", error); });
    }
  },

  // ── Walks ──────────────────────────────────────────────────────────────────
  createWalk: (walk) => {
    set((s) => ({ personalWalks: [walk, ...s.personalWalks] }));
    get().persist();
    const { user } = get();
    if (user && walk.isPublic) {
      const allStops = walk.stops.map((st) => walkStopToDb(st, user.id));
      supabase.from("walks").insert(walkToDb(walk, user.id))
        .then(({ error }) => { if (error) console.error("createWalk sync:", error); });
      if (allStops.length > 0) {
        supabase.from("walk_stops").insert(allStops)
          .then(({ error }) => { if (error) console.error("createWalk stops sync:", error); });
      }
    }
  },

  updateWalk: (walk) => {
    set((s) => ({ personalWalks: s.personalWalks.map((w) => (w.id === walk.id ? walk : w)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walks").upsert(walkToDb(walk, user.id))
        .then(({ error }) => { if (error) console.error("updateWalk sync:", error); });
      supabase.from("walk_stops").delete().eq("walk_id", walk.id)
        .then(() => {
          if (walk.stops.length > 0) {
            supabase.from("walk_stops").insert(walk.stops.map((st) => walkStopToDb(st, user.id)))
              .then(({ error }) => { if (error) console.error("updateWalk stops sync:", error); });
          }
        });
    }
  },

  deleteWalk: (id) => {
    set((s) => ({ personalWalks: s.personalWalks.filter((w) => w.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walks").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteWalk sync:", error); });
    }
  },

  fetchCommunityWalks: async () => {
    try {
      const { data, error } = await supabase
        .from("walks")
        .select("*, walk_stops(*)")
        .eq("is_public", true)
        .order("is_featured", { ascending: false })
        .order("completion_count", { ascending: false });
      if (error) { console.error("fetchCommunityWalks:", error); return; }
      set({ communityWalks: (data ?? []).map(dbToWalk) });
    } catch (e) {
      console.error("fetchCommunityWalks failed:", e);
    }
  },

  markWalkComplete: (completion) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ completions: [...s.completions, completion] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("walk_completions").insert(completionToDb(completion))
        .then(({ error }) => { if (error) console.error("markWalkComplete sync:", error); });
      // increment completion_count on the walk
      supabase.rpc("increment_walk_completion", { walk_id: completion.walkId })
        .then(({ error }) => { if (error) console.error("increment_walk_completion:", error); });
    }
  },

  unmarkWalkComplete: (completionId) => {
    const completion = get().completions.find((c) => c.id === completionId);
    set((s) => ({ completions: s.completions.filter((c) => c.id !== completionId) }));
    get().persist();
    const { user } = get();
    if (user && completion) {
      supabase.from("walk_completions").delete().eq("id", completionId)
        .then(({ error }) => { if (error) console.error("unmarkWalkComplete sync:", error); });
      supabase.rpc("decrement_walk_completion", { walk_id: completion.walkId })
        .then(({ error }) => { if (error) console.error("decrement_walk_completion:", error); });
    }
  },

  submitReview: (review) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      myReviews: [...s.myReviews.filter((r) => r.walkId !== review.walkId), review],
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("walk_reviews").upsert(reviewToDb(review))
        .then(({ error }) => {
          if (error) { console.error("submitReview sync:", error); return; }
          supabase.rpc("refresh_walk_avg_rating", { walk_id: review.walkId })
            .then(({ error: e }) => { if (e) console.error("refresh_walk_avg_rating:", e); });
          get().fetchWalkReviews(review.walkId);
        });
    }
  },

  deleteReview: (reviewId) => {
    const review = get().myReviews.find((r) => r.id === reviewId);
    if (!review) return;
    set((s) => ({ myReviews: s.myReviews.filter((r) => r.id !== reviewId) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walk_reviews").delete().eq("id", reviewId)
        .then(({ error }) => {
          if (error) {
            console.error("deleteReview sync:", error);
            // Restore locally if Supabase rejected — prevents it reappearing on next sync
            set((s) => ({ myReviews: [...s.myReviews.filter((r) => r.id !== review.id), review] }));
            get().persist();
          } else {
            supabase.rpc("refresh_walk_avg_rating", { walk_id: review.walkId })
              .then(({ error: e }) => { if (e) console.error("refresh_walk_avg_rating:", e); });
            // Refresh the community reviews list for this walk
            get().fetchWalkReviews(review.walkId);
          }
        });
    }
  },

  fetchWalkReviews: async (walkId) => {
    const { data, error } = await supabase
      .from("walk_reviews")
      .select("*")
      .eq("walk_id", walkId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      set({ walkReviews: data.map(dbToReview) });
    }
  },

  dismissNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  subscribeToCreatorNotifications: (userId) => {
    // Track walkId:completerId pairs recently notified to prevent duplicates
    // when both the completion and review Realtime events fire for the same action
    const notified = new Set<string>();

    function pushWalkNotif(walkTitle: string, review: { rating: number; body?: string } | null) {
      set((s) => ({
        notifications: [
          ...s.notifications,
          {
            id: uid(),
            type: "walk_completed" as const,
            emoji: "👟",
            title: walkTitle,
            message: "A photographer just completed your walk.",
            subtitle: review ? "★".repeat(review.rating) + "☆".repeat(5 - review.rating) : undefined,
            subtext: review?.body,
          },
        ],
      }));
    }

    // Primary trigger: walk_reviews INSERT — fires when the reviewer submits a rating/review
    // The walk_reviews_select policy already lets walk creators see reviews on their walks,
    // so Realtime delivers these events. This is the richest source (has stars + body).
    const reviewChannel = supabase
      .channel(`creator-reviews-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "walk_reviews" },
        (payload: any) => {
          const row = payload.new;
          if (row.user_id === userId) return;
          const walk = get().personalWalks.find((w) => w.id === row.walk_id);
          if (!walk) return;
          const key = `${row.walk_id}:${row.user_id}`;
          notified.add(key);
          setTimeout(() => notified.delete(key), 10000);
          pushWalkNotif(walk.title, dbToReview(row));
        }
      )
      .subscribe();

    // Secondary trigger: walk_completions INSERT — fires for users who complete without reviewing.
    // Waits 4s then fires only if the review channel hasn't already handled this pair.
    const completionChannel = supabase
      .channel(`creator-completions-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "walk_completions" },
        async (payload: any) => {
          const row = payload.new;
          if (row.user_id === userId) return;
          const walk = get().personalWalks.find((w) => w.id === row.walk_id);
          if (!walk) return;
          const key = `${row.walk_id}:${row.user_id}`;
          // Give the review channel time to fire first
          await new Promise((r) => setTimeout(r, 4000));
          if (notified.has(key)) return; // review channel already sent a notification
          notified.add(key);
          setTimeout(() => notified.delete(key), 10000);
          pushWalkNotif(walk.title, null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewChannel);
      supabase.removeChannel(completionChannel);
    };
  },

  // ── Profiles ───────────────────────────────────────────────────────────────
  loadMyProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!error && data) set({ myProfile: dbToProfile(data) });
  },

  saveProfile: async ({ handle, displayName, bio, isPublic, avatarUrl }) => {
    const { user, myProfile } = get();
    if (!user) return { error: "Not signed in." };
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle.length < 3) return { error: "Handle must be at least 3 characters." };
    if (cleanHandle.length > 20) return { error: "Handle must be 20 characters or fewer." };
    const profile: UserProfile = {
      userId: user.id,
      handle: cleanHandle,
      displayName: displayName?.trim() || undefined,
      bio: bio?.trim() || undefined,
      isPublic,
      avatarUrl: avatarUrl ?? myProfile?.avatarUrl,
      createdAt: myProfile?.createdAt ?? new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(profileToDb(profile), { onConflict: "user_id" });
    if (error) {
      if (error.code === "23505") return { error: "That handle is already taken." };
      return { error: error.message };
    }
    set({ myProfile: profile });
    return {};
  },

  fetchPublicProfile: async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return dbToProfile(data);
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  setUser: (user) => {
    set({ user });
    // Persist the userId so sign-in can detect a different account on the same device
    if (user) {
      AsyncStorage.setItem(KEYS.userId, user.id);
    } else {
      AsyncStorage.removeItem(KEYS.userId);
    }
  },

  // Sign-out: clears session and gear but KEEPS rolls in state and localStorage.
  // Rolls are local-first data — they survive sign-out so the same user gets them
  // back on re-login without depending on a successful Supabase round-trip.
  // userId is intentionally kept in AsyncStorage so _layout can detect a different
  // account logging in and wipe local data before uploading.
  clearUserData: () => {
    set({ cameras: DEFAULT_CAMERAS, filmStocks: DEFAULT_FILM_STOCKS, user: null, myProfile: null, notifications: [] });
    AsyncStorage.multiRemove([KEYS.cameras, KEYS.filmStocks]);
  },

  // Hard reset: wipes everything including rolls. Called only when a different
  // account signs in on this device.
  clearAllData: () => {
    set({ rolls: [], cameras: DEFAULT_CAMERAS, filmStocks: DEFAULT_FILM_STOCKS, journals: [], personalWalks: [], communityWalks: [], completions: [], myReviews: [], walkReviews: [], myProfile: null, user: null, notifications: [], shownProgressNudges: [] });
    AsyncStorage.multiRemove([KEYS.rolls, KEYS.cameras, KEYS.filmStocks, KEYS.journals, KEYS.personalWalks, KEYS.completions, KEYS.myReviews, KEYS.userId, KEYS.shownNudges]);
  },

  // ── Supabase sync ──────────────────────────────────────────────────────────
  syncFromSupabase: async (userId) => {
    try {
      const [rollsRes, camerasRes, stocksRes, journalsRes, walksRes, completionsRes, reviewsRes] = await Promise.all([
        supabase.from("rolls").select("*, shots(*)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("cameras").select("*").eq("user_id", userId),
        supabase.from("film_stocks").select("*").eq("user_id", userId),
        supabase.from("location_journals").select("*").eq("user_id", userId),
        supabase.from("walks").select("*, walk_stops(*)").eq("created_by_user_id", userId),
        supabase.from("walk_completions").select("*").eq("user_id", userId),
        supabase.from("walk_reviews").select("*").eq("user_id", userId),
      ]);

      if (rollsRes.error || camerasRes.error || stocksRes.error) {
        console.error("syncFromSupabase query error:", rollsRes.error ?? camerasRes.error ?? stocksRes.error);
        return;
      }

      const remoteRolls = (rollsRes.data ?? []).map(dbToRoll);
      const remoteIds = new Set(remoteRolls.map((r) => r.id));
      const localOnly = get().rolls.filter((r) => !remoteIds.has(r.id));

      // For rolls that exist in both places, preserve any local shots not yet
      // confirmed in Supabase (prevents locally-added shots being wiped on sync)
      const localRollMap = new Map(get().rolls.map((r) => [r.id, r]));
      const mergedRemoteRolls = remoteRolls.map((remote) => {
        const local = localRollMap.get(remote.id);
        if (!local || local.shots.length === 0) return remote;
        const remoteShotIds = new Set(remote.shots.map((s) => s.id));
        const pendingShots = local.shots.filter((s) => !remoteShotIds.has(s.id));
        return pendingShots.length > 0
          ? { ...remote, shots: [...remote.shots, ...pendingShots] }
          : remote;
      });

      const customCameras: Camera[] = (camerasRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, isCustom: true,
      }));
      const customStocks: FilmStock[] = (stocksRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, iso: r.iso, isCustom: true,
      }));

      let journals = get().journals;
      if (!journalsRes.error && journalsRes.data) {
        const remoteJournals = journalsRes.data.map(dbToJournal);
        const remoteLabels = new Set(remoteJournals.map((j) => j.locationLabel.toLowerCase()));
        const localOnlyJournals = journals.filter((j) => !remoteLabels.has(j.locationLabel.toLowerCase()));
        journals = [...remoteJournals, ...localOnlyJournals];
      }

      let personalWalks = get().personalWalks;
      if (!walksRes.error && walksRes.data) {
        const remoteWalks = walksRes.data.map(dbToWalk);
        const remoteWalkIds = new Set(remoteWalks.map((w) => w.id));
        const localOnlyWalks = personalWalks.filter((w) => !remoteWalkIds.has(w.id));
        personalWalks = [...remoteWalks, ...localOnlyWalks];
      }

      const completions = !completionsRes.error && completionsRes.data
        ? completionsRes.data.map(dbToCompletion)
        : get().completions;
      const myReviews = !reviewsRes.error && reviewsRes.data
        ? reviewsRes.data.map(dbToReview)
        : get().myReviews;

      set({
        rolls: [...mergedRemoteRolls, ...localOnly],
        cameras: [...DEFAULT_CAMERAS, ...customCameras],
        filmStocks: [...DEFAULT_FILM_STOCKS, ...customStocks],
        journals,
        personalWalks,
        completions,
        myReviews,
      });
      get().persist();
    } catch (e) {
      console.error("syncFromSupabase failed:", e);
    }
  },

  uploadLocalToSupabase: async (userId) => {
    const { rolls, cameras, filmStocks, journals, personalWalks, completions, myReviews } = get();
    try {
      const customCameras = cameras.filter((c) => c.isCustom);
      const customStocks = filmStocks.filter((f) => f.isCustom);
      const allShots = rolls.flatMap((r) => r.shots.map((s) => shotToDb(s, r.id, userId)));
      const publicWalks = personalWalks.filter((w) => w.isPublic);
      const allStops = publicWalks.flatMap((w) => w.stops.map((st) => walkStopToDb(st, userId)));

      await Promise.all([
        rolls.length > 0
          ? supabase.from("rolls").upsert(rolls.map((r) => rollToDb(r, userId)))
          : Promise.resolve(),
        allShots.length > 0
          ? supabase.from("shots").upsert(allShots)
          : Promise.resolve(),
        customCameras.length > 0
          ? supabase.from("cameras").upsert(customCameras.map((c) => ({ id: c.id, user_id: userId, name: c.name })))
          : Promise.resolve(),
        customStocks.length > 0
          ? supabase.from("film_stocks").upsert(customStocks.map((f) => ({ id: f.id, user_id: userId, name: f.name, iso: f.iso })))
          : Promise.resolve(),
        journals.length > 0
          ? supabase.from("location_journals").upsert(journals.map((j) => journalToDb(j, userId)))
          : Promise.resolve(),
        publicWalks.length > 0
          ? supabase.from("walks").upsert(publicWalks.map((w) => walkToDb(w, userId)))
          : Promise.resolve(),
        allStops.length > 0
          ? supabase.from("walk_stops").upsert(allStops)
          : Promise.resolve(),
        completions.length > 0
          ? supabase.from("walk_completions").upsert(completions.map(completionToDb))
          : Promise.resolve(),
        myReviews.length > 0
          ? supabase.from("walk_reviews").upsert(myReviews.map(reviewToDb))
          : Promise.resolve(),
      ]);
    } catch (e) {
      console.error("uploadLocalToSupabase failed:", e);
    }
  },

  // ── Local persistence ──────────────────────────────────────────────────────
  hydrate: async () => {
    try {
      const [rollsRaw, camerasRaw, stocksRaw, journalsRaw, walksRaw, completionsRaw, reviewsRaw, nudgesRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.rolls),
        AsyncStorage.getItem(KEYS.cameras),
        AsyncStorage.getItem(KEYS.filmStocks),
        AsyncStorage.getItem(KEYS.journals),
        AsyncStorage.getItem(KEYS.personalWalks),
        AsyncStorage.getItem(KEYS.completions),
        AsyncStorage.getItem(KEYS.myReviews),
        AsyncStorage.getItem(KEYS.shownNudges),
      ]);
      set({
        rolls: rollsRaw ? JSON.parse(rollsRaw) : [],
        cameras: camerasRaw ? JSON.parse(camerasRaw) : DEFAULT_CAMERAS,
        filmStocks: stocksRaw ? JSON.parse(stocksRaw) : DEFAULT_FILM_STOCKS,
        journals: journalsRaw ? JSON.parse(journalsRaw) : [],
        personalWalks: walksRaw ? JSON.parse(walksRaw) : [],
        completions: completionsRaw ? JSON.parse(completionsRaw) : [],
        myReviews: reviewsRaw ? JSON.parse(reviewsRaw) : [],
        shownProgressNudges: nudgesRaw ? JSON.parse(nudgesRaw) : [],
        hydrated: true,
      });
    } catch (e) {
      console.error("Hydration failed:", e);
      set({ hydrated: true });
    }
  },

  persist: async () => {
    const { rolls, cameras, filmStocks, journals, personalWalks, completions, myReviews, shownProgressNudges } = get();
    try {
      await Promise.all([
        AsyncStorage.setItem(KEYS.rolls, JSON.stringify(rolls)),
        AsyncStorage.setItem(KEYS.cameras, JSON.stringify(cameras)),
        AsyncStorage.setItem(KEYS.filmStocks, JSON.stringify(filmStocks)),
        AsyncStorage.setItem(KEYS.journals, JSON.stringify(journals)),
        AsyncStorage.setItem(KEYS.personalWalks, JSON.stringify(personalWalks)),
        AsyncStorage.setItem(KEYS.completions, JSON.stringify(completions)),
        AsyncStorage.setItem(KEYS.myReviews, JSON.stringify(myReviews)),
        AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify(shownProgressNudges)),
      ]);
    } catch (e) {
      console.error("Persist failed:", e);
    }
  },
}));
