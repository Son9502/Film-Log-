import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { COLORS, MAX_STARS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { supabase } from "@/services/supabase";
import { UserProfile, Walk, Roll } from "@/types";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: COLORS.success,
  Moderate: COLORS.amber,
  Challenging: COLORS.danger,
};

const AVATAR_SIZE = 72;

function dbToWalkBasic(row: any): Walk {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    city: row.city ?? undefined,
    tags: row.tags ? (() => { try { return JSON.parse(row.tags); } catch { return []; } })() : undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    distanceKm: row.distance_km ?? undefined,
    difficulty: row.difficulty ?? undefined,
    isPublic: row.is_public,
    isFeatured: row.is_featured,
    createdByUserId: row.created_by_user_id ?? undefined,
    stops: [],
    completionCount: row.completion_count ?? 0,
    avgRating: row.avg_rating ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbToRollBasic(row: any): Roll {
  return {
    id: row.id,
    name: row.name ?? undefined,
    filmStockId: row.film_stock_id,
    cameraId: row.camera_id,
    iso: row.iso,
    frameCount: row.frame_count,
    status: row.status,
    loadedAt: row.loaded_at,
    shots: [],
    isPublic: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function AvatarCircle({ profile }: { profile: UserProfile }) {
  const initial = (profile.displayName || profile.handle).charAt(0).toUpperCase();
  return (
    <View style={av.circle}>
      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={av.image} />
      ) : (
        <Text style={av.initial}>{initial}</Text>
      )}
    </View>
  );
}

const av = StyleSheet.create({
  circle: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    marginRight: 16,
  },
  image: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  initial: { fontSize: 26, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold" },
});

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user, myProfile, rolls, completions, personalWalks } = useFilmLogStore();

  const isOwnProfile = user?.id === userId;

  const [profile, setProfile]       = useState<UserProfile | null>(isOwnProfile ? myProfile : null);
  const [walks, setWalks]           = useState<Walk[]>([]);
  const [publicRolls, setPublicRolls] = useState<Roll[]>([]);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);

      if (isOwnProfile && myProfile) {
        setProfile(myProfile);
      } else {
        const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        if (!data || (!data.is_public && !isOwnProfile)) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setProfile({
          userId: data.user_id,
          handle: data.handle,
          displayName: data.display_name ?? undefined,
          bio: data.bio ?? undefined,
          isPublic: data.is_public,
          avatarUrl: data.avatar_url ?? undefined,
          createdAt: data.created_at,
        });
      }

      const [walkRes, rollRes] = await Promise.all([
        supabase.from("walks").select("*")
          .eq("created_by_user_id", userId).eq("is_public", true)
          .order("created_at", { ascending: false }),
        supabase.from("rolls").select("id, name, film_stock_id, camera_id, iso, frame_count, status, loaded_at, created_at, updated_at")
          .eq("user_id", userId).eq("is_public", true)
          .order("created_at", { ascending: false }),
      ]);

      if (walkRes.data) setWalks(walkRes.data.map(dbToWalkBasic));
      if (rollRes.data) setPublicRolls(rollRes.data.map(dbToRollBasic));

      setLoading(false);
    }
    load();
  }, [userId, isOwnProfile]);

  const ownRollCount       = isOwnProfile ? rolls.length : 0;
  const ownFrameCount      = isOwnProfile ? rolls.reduce((s, r) => s + r.shots.length, 0) : 0;
  const ownCompletionCount = isOwnProfile ? completions.length : 0;
  const ownWalkCount       = isOwnProfile ? personalWalks.filter((w) => w.isPublic).length : 0;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.amber} />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <>
        <Stack.Screen options={{ title: "Profile" }} />
        <View style={s.center}>
          <Text style={s.notFoundTitle}>No public profile</Text>
          <Text style={s.notFoundSub}>This photographer hasn't set up a public profile yet.</Text>
          {isOwnProfile && (
            <TouchableOpacity style={s.ctaBtn} onPress={() => router.replace("/settings/profile")}>
              <Text style={s.ctaBtnText}>Set up my profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  }

  const ratedWalks = walks.filter((w) => w.avgRating != null);
  const overallAvg = ratedWalks.length > 0
    ? ratedWalks.reduce((s, w) => s + w.avgRating!, 0) / ratedWalks.length
    : null;

  // For own profile, show all rolls; for others show only fetched public rolls
  const displayRolls = isOwnProfile ? rolls.filter((r) => r.isPublic) : publicRolls;

  return (
    <>
      <Stack.Screen options={{ title: `@${profile.handle}` }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Identity card */}
        <View style={s.identityCard}>
          <View style={s.identityRow}>
            <AvatarCircle profile={profile} />
            <View style={s.identityText}>
              {profile.displayName ? (
                <Text style={s.displayName}>{profile.displayName}</Text>
              ) : null}
              <View style={s.handleRow}>
                <Text style={s.handleText}>@{profile.handle}</Text>
                {!profile.isPublic && isOwnProfile && (
                  <View style={s.privatePill}><Text style={s.privatePillText}>Private</Text></View>
                )}
              </View>
              <Text style={s.memberSince}>Since {profile.createdAt.slice(0, 7)}</Text>
            </View>
          </View>
          {profile.bio ? (
            <Text style={s.bio}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Own profile stats row */}
        {isOwnProfile && (
          <>
            <Text style={s.sectionLabel}>My Stats</Text>
            <View style={s.statsGrid}>
              {[
                [ownRollCount, "rolls"],
                [ownFrameCount, "frames"],
                [ownCompletionCount, "walks done"],
                [ownWalkCount, "walks shared"],
              ].map(([n, lbl]) => (
                <View key={String(lbl)} style={s.statCell}>
                  <Text style={s.statNum}>{n}</Text>
                  <Text style={s.statLbl}>{lbl}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Public Rolls */}
        {(displayRolls.length > 0 || isOwnProfile) && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>
              {isOwnProfile ? "My Public Rolls" : "Public Rolls"}
            </Text>
            {displayRolls.length === 0 ? (
              <Text style={s.empty}>No public rolls yet.</Text>
            ) : (
              displayRolls.map((roll) => (
                <TouchableOpacity
                  key={roll.id}
                  style={s.rollCard}
                  onPress={() => isOwnProfile
                    ? router.push(`/roll/${roll.id}`)
                    : undefined
                  }
                  activeOpacity={isOwnProfile ? 0.7 : 1}
                >
                  <View style={s.rollCardTop}>
                    <Text style={s.rollTitle}>{roll.name ?? roll.filmStockId}</Text>
                    <View style={[s.rollStatusBadge, { borderColor: COLORS.textDim }]}>
                      <Text style={s.rollStatusText}>{roll.status}</Text>
                    </View>
                  </View>
                  <Text style={s.rollMeta}>
                    {roll.frameCount} frames · {roll.loadedAt?.slice(0, 7)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* Public Walks */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>
          {isOwnProfile ? "My Public Walks" : "Walks"}
        </Text>

        {walks.length === 0 ? (
          <Text style={s.empty}>No public walks yet.</Text>
        ) : (
          <>
            {overallAvg != null && (
              <Text style={s.overallRating}>
                {"★".repeat(Math.round(overallAvg))}{"☆".repeat(MAX_STARS - Math.round(overallAvg))}
                {" "}avg across {ratedWalks.length} rated {ratedWalks.length === 1 ? "walk" : "walks"}
              </Text>
            )}
            {walks.map((walk) => (
              <TouchableOpacity
                key={walk.id}
                style={s.walkCard}
                onPress={() => router.push({ pathname: "/walks/[id]", params: { id: walk.id } })}
              >
                <View style={s.walkCardTop}>
                  <Text style={s.walkTitle}>{walk.title}</Text>
                  {walk.isFeatured && <Text style={s.featuredBadge}>★ Featured</Text>}
                </View>
                <View style={s.walkMeta}>
                  {walk.city && <Text style={s.walkMetaText}>{walk.city}</Text>}
                  {walk.difficulty && (
                    <Text style={[s.walkMetaText, { color: DIFFICULTY_COLOR[walk.difficulty] ?? COLORS.textDim }]}>
                      {walk.difficulty}
                    </Text>
                  )}
                  {walk.estimatedMinutes != null && (
                    <Text style={s.walkMetaText}>{walk.estimatedMinutes} min</Text>
                  )}
                </View>
                <View style={s.walkFooter}>
                  <Text style={s.completionText}>
                    {walk.completionCount === 0 ? "No completions"
                      : `${walk.completionCount} ${walk.completionCount === 1 ? "completion" : "completions"}`}
                  </Text>
                  {walk.avgRating != null && (
                    <Text style={s.avgRating}>
                      {"★".repeat(Math.round(walk.avgRating))}{"☆".repeat(MAX_STARS - Math.round(walk.avgRating))}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Edit own profile shortcut */}
        {isOwnProfile && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 28 }]}>Account</Text>
            <TouchableOpacity style={s.editBtn} onPress={() => router.push("/settings/profile")}>
              <Text style={s.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg, padding: 32 },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 12, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  identityCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 18, marginBottom: 24,
  },
  identityRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  identityText: { flex: 1 },
  displayName: {
    fontSize: 16, color: COLORS.textPrimary, fontFamily: "Courier New",
    fontWeight: "bold", marginBottom: 2,
  },
  handleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  handleText: { fontSize: 14, color: COLORS.amber, fontFamily: "Courier New" },
  privatePill: {
    borderWidth: 1, borderColor: COLORS.textDim,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  privatePillText: { fontSize: 8, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1 },
  memberSince: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New" },
  bio: { fontSize: 12, color: COLORS.textSecondary, fontFamily: "Courier New", lineHeight: 18 },

  statsGrid: {
    flexDirection: "row", backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statCell: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: COLORS.borderSubtle,
  },
  statNum: { fontSize: 18, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold" },
  statLbl: { fontSize: 8, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 0.5, marginTop: 2 },

  overallRating: {
    fontSize: 11, color: COLORS.amber, fontFamily: "Courier New",
    marginBottom: 12, letterSpacing: 1,
  },

  rollCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderSubtle,
    padding: 12, marginBottom: 8,
  },
  rollCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  rollTitle: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold", flex: 1, marginRight: 8 },
  rollStatusBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  rollStatusText: { fontSize: 8, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1 },
  rollMeta: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New" },

  walkCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderSubtle,
    padding: 14, marginBottom: 8,
  },
  walkCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  walkTitle: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold", flex: 1, marginRight: 8 },
  featuredBadge: { fontSize: 8, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 0.5 },
  walkMeta: { flexDirection: "row", gap: 12, marginBottom: 8 },
  walkMetaText: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New" },
  walkFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 8 },
  completionText: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New" },
  avgRating: { fontSize: 11, color: COLORS.amber, letterSpacing: 1 },

  empty: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", fontStyle: "italic", paddingBottom: 8 },

  editBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 13, alignItems: "center",
  },
  editBtnText: { fontSize: 11, color: COLORS.textPrimary, fontFamily: "Courier New", letterSpacing: 2 },

  notFoundTitle: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New", marginBottom: 8, textAlign: "center" },
  notFoundSub: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", textAlign: "center", lineHeight: 16, marginBottom: 20 },
  ctaBtn: { borderWidth: 1, borderColor: COLORS.amber, paddingVertical: 12, paddingHorizontal: 24 },
  ctaBtnText: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
});
