import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert,
} from "react-native";
import { useState, useMemo, useEffect } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { COLORS, MAX_STARS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { uid } from "@/utils";
import { UserProfile } from "@/types";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: COLORS.success,
  Moderate: COLORS.amber,
  Challenging: COLORS.danger,
};

export default function WalkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    personalWalks, communityWalks, completions, myReviews, walkReviews,
    user, markWalkComplete, unmarkWalkComplete, submitReview, deleteReview, deleteWalk,
    fetchWalkReviews, fetchPublicProfile,
  } = useFilmLogStore();

  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);

  const walk = useMemo(
    () => [...personalWalks, ...communityWalks].find((w) => w.id === id),
    [personalWalks, communityWalks, id]
  );

  const myCompletion = completions.find((c) => c.walkId === id);
  const myReview = myReviews.find((r) => r.walkId === id);
  const isOwner =
    personalWalks.some((w) => w.id === id) ||
    (!!user?.id && user.id === walk?.createdByUserId);

  const [reviewRating, setReviewRating] = useState(myReview?.rating ?? 0);
  const [reviewBody, setReviewBody] = useState(myReview?.body ?? "");
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (id) fetchWalkReviews(id);
  }, [id]);

  useEffect(() => {
    if (!walk?.createdByUserId || walk.createdByUserId === user?.id) return;
    fetchPublicProfile(walk.createdByUserId).then(setCreatorProfile);
  }, [walk?.createdByUserId]);

  if (!walk) {
    return (
      <View style={s.center}>
        <Text style={s.notFound}>Walk not found.</Text>
      </View>
    );
  }

  function handleComplete() {
    if (!user) return;
    markWalkComplete({
      id: uid(),
      walkId: walk!.id,
      userId: user.id,
      completedAt: new Date().toISOString(),
    });
  }

  function handleUncomplete() {
    if (!myCompletion) return;
    unmarkWalkComplete(myCompletion.id);
  }

  function handleSubmitReview() {
    if (!user || reviewRating === 0) return;
    submitReview({
      id: myReview?.id ?? uid(),
      walkId: walk!.id,
      userId: user.id,
      rating: reviewRating,
      body: reviewBody.trim() || undefined,
      createdAt: myReview?.createdAt ?? new Date().toISOString(),
    });
    setReviewMode(false);
  }

  function handleDeleteWalk() {
    deleteWalk(walk!.id);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: walk.title }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.headerCard}>
          <View style={s.headerTop}>
            {walk.isFeatured && <Text style={s.featuredBadge}>★ Recommended</Text>}
            {walk.isPublic && !walk.isFeatured && <Text style={s.publicBadge}>Public</Text>}
            {!walk.isPublic && <Text style={s.privateBadge}>Private</Text>}
          </View>
          {walk.city && <Text style={s.city}>{walk.city}</Text>}
          {walk.description && <Text style={s.description}>{walk.description}</Text>}
          {creatorProfile && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: walk.createdByUserId! } })}
            >
              <Text style={s.creatorHandle}>By @{creatorProfile.handle}</Text>
            </TouchableOpacity>
          )}

          <View style={s.metaRow}>
            {walk.difficulty && (
              <Text style={[s.difficulty, { color: DIFFICULTY_COLOR[walk.difficulty] ?? COLORS.textMuted }]}>
                {walk.difficulty}
              </Text>
            )}
            {walk.estimatedMinutes != null && <Text style={s.meta}>{walk.estimatedMinutes} min</Text>}
            {walk.distanceKm != null && <Text style={s.meta}>{walk.distanceKm} km</Text>}
            <Text style={s.meta}>{walk.stops.length} stops</Text>
          </View>

          <View style={s.completionRow}>
            <Text style={s.completionCount}>
              {walk.completionCount === 0
                ? "No completions yet"
                : `${walk.completionCount} ${walk.completionCount === 1 ? "person" : "people"} completed this walk`}
            </Text>
            {walk.avgRating != null && (
              <Text style={s.avgRating}>
                {"★".repeat(Math.round(walk.avgRating))}{"☆".repeat(5 - Math.round(walk.avgRating))} avg
              </Text>
            )}
          </View>

          {walk.tags && walk.tags.length > 0 && (
            <View style={s.tagRow}>
              {walk.tags.map((t) => (
                <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
              ))}
            </View>
          )}
        </View>

        {/* Stops */}
        <Text style={s.sectionLabel}>Stops</Text>
        {walk.stops.map((stop, idx) => (
          <View key={stop.id} style={s.stopCard}>
            <View style={s.stopNum}><Text style={s.stopNumText}>{idx + 1}</Text></View>
            <View style={s.stopBody}>
              <Text style={s.stopTitle}>{stop.title}</Text>
              {stop.locationLabel && <Text style={s.stopLocation}>📍 {stop.locationLabel}</Text>}
              {stop.description && <Text style={s.stopDesc}>{stop.description}</Text>}
            </View>
          </View>
        ))}
        {walk.stops.length === 0 && (
          <Text style={s.noStops}>No stops added yet.</Text>
        )}

        {/* Completion */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>Completion</Text>
        {myCompletion ? (
          <View style={s.completedCard}>
            <Text style={s.completedText}>
              ✓ Completed on {myCompletion.completedAt.slice(0, 10)}
            </Text>
            <TouchableOpacity onPress={handleUncomplete}>
              <Text style={s.uncompleteText}>Unmark</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.completeBtn} onPress={handleComplete} disabled={!user}>
            <Text style={s.completeBtnText}>Mark as Complete</Text>
          </TouchableOpacity>
        )}

        {/* Review — only if completed */}
        {myCompletion && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Your Review</Text>
            {myReview && !reviewMode ? (
              <View style={s.reviewCard}>
                <Text style={s.reviewStars}>{"★".repeat(myReview.rating)}{"☆".repeat(MAX_STARS - myReview.rating)}</Text>
                {myReview.body && <Text style={s.reviewBody}>{myReview.body}</Text>}
                <View style={s.reviewActions}>
                  <TouchableOpacity onPress={() => { setReviewMode(true); setReviewRating(myReview.rating); setReviewBody(myReview.body ?? ""); }}>
                    <Text style={s.reviewEdit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => myReview && deleteReview(myReview.id)}>
                    <Text style={s.reviewDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={s.reviewForm}>
                <Text style={s.label}>Rating</Text>
                <View style={s.starRow}>
                  {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((star) => (
                    <TouchableOpacity key={star} onPress={() => setReviewRating(reviewRating === star ? 0 : star)}>
                      <Text style={[s.star, star <= reviewRating && s.starFilled]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.label}>Notes (optional)</Text>
                <TextInput
                  style={s.textArea}
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="What did you think?"
                  placeholderTextColor={COLORS.textDim}
                  multiline
                  numberOfLines={3}
                />
                <View style={s.reviewFormActions}>
                  {reviewMode && (
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setReviewMode(false)}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.submitBtn, reviewRating === 0 && s.submitBtnDisabled]}
                    onPress={handleSubmitReview}
                    disabled={reviewRating === 0}
                  >
                    <Text style={s.submitText}>{myReview ? "Update Review" : "Submit Review"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* Community reviews */}
        {walk.isPublic && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Reviews</Text>
            {walkReviews.length === 0 ? (
              <Text style={s.noReviews}>No reviews yet. Be the first!</Text>
            ) : (
              walkReviews.map((r) => (
                <View key={r.id} style={s.communityReviewCard}>
                  <View style={s.communityReviewHeader}>
                    <Text style={s.communityReviewStars}>
                      {"★".repeat(r.rating)}{"☆".repeat(MAX_STARS - r.rating)}
                    </Text>
                    {r.userId === user?.id && (
                      <Text style={s.communityReviewYou}>you</Text>
                    )}
                  </View>
                  {r.body ? (
                    <Text style={s.communityReviewBody}>{r.body}</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}

        {/* Owner actions */}
        {isOwner && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Manage</Text>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => router.push({ pathname: "/walks/new", params: { editId: walk.id } })}
            >
              <Text style={s.editBtnText}>Edit Walk</Text>
            </TouchableOpacity>
            {!confirmDelete ? (
              <TouchableOpacity style={s.deleteBtn} onPress={() => setConfirmDelete(true)}>
                <Text style={s.deleteBtnText}>Delete Walk</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.confirmRow}>
                <Text style={s.confirmText}>Delete permanently?</Text>
                <TouchableOpacity onPress={handleDeleteWalk}>
                  <Text style={[s.deleteBtnText, { marginLeft: 12 }]}>Yes, Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete(false)}>
                  <Text style={[s.cancelText, { marginLeft: 12 }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  notFound: { fontSize: 12, color: COLORS.textDim, fontFamily: "Courier New" },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  headerCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 20,
  },
  headerTop: { flexDirection: "row", gap: 8, marginBottom: 6 },
  featuredBadge: { fontSize: 9, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
  publicBadge: { fontSize: 9, color: COLORS.info, fontFamily: "Courier New", letterSpacing: 1 },
  privateBadge: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1 },
  city: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 0.5, marginBottom: 6 },
  description: { fontSize: 12, color: COLORS.textSecondary, fontFamily: "Courier New", lineHeight: 18, marginBottom: 8 },
  creatorHandle: { fontSize: 10, color: COLORS.amberLight, fontFamily: "Courier New", marginBottom: 10, letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
  meta: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New" },
  difficulty: { fontSize: 9, fontFamily: "Courier New", fontWeight: "bold" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New" },

  completionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1, borderTopColor: COLORS.borderSubtle,
  },
  completionCount: { fontSize: 11, color: COLORS.textSecondary, fontFamily: "Courier New" },
  avgRating: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },

  stopCard: {
    flexDirection: "row", backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    marginBottom: 8, overflow: "hidden",
  },
  stopNum: {
    width: 36, backgroundColor: COLORS.bgElevated,
    alignItems: "center", justifyContent: "center", paddingVertical: 12,
  },
  stopNumText: { fontSize: 13, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold" },
  stopBody: { flex: 1, padding: 12 },
  stopTitle: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold", marginBottom: 3 },
  stopLocation: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginBottom: 4, letterSpacing: 0.3 },
  stopDesc: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 16 },
  noStops: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", fontStyle: "italic", paddingBottom: 8 },

  completedCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.success,
    padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  completedText: { fontSize: 11, color: COLORS.success, fontFamily: "Courier New" },
  uncompleteText: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1 },
  completeBtn: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.amber,
    paddingVertical: 14, alignItems: "center",
  },
  completeBtnText: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 2, textTransform: "uppercase" },

  reviewCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  reviewStars: { fontSize: 16, color: COLORS.amber, letterSpacing: 2, marginBottom: 6 },
  reviewBody: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 16, marginBottom: 10 },
  reviewActions: { flexDirection: "row", gap: 16 },
  reviewEdit: { fontSize: 9, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
  reviewDelete: { fontSize: 9, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 1 },

  reviewForm: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  label: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  starRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  star: { fontSize: 22, color: COLORS.textDim },
  starFilled: { color: COLORS.amber },
  textArea: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 12,
    padding: 10, minHeight: 70, textAlignVertical: "top", marginBottom: 12,
  },
  reviewFormActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  submitBtn: { backgroundColor: COLORS.amber, paddingVertical: 10, paddingHorizontal: 16 },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 10, color: COLORS.bg, fontFamily: "Courier New", letterSpacing: 1, fontWeight: "bold" },

  noReviews: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New",
    fontStyle: "italic", paddingBottom: 8,
  },
  communityReviewCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderSubtle,
    padding: 12, marginBottom: 8,
  },
  communityReviewHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  communityReviewStars: { fontSize: 14, color: COLORS.amber, letterSpacing: 2 },
  communityReviewYou: {
    fontSize: 8, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 1, textTransform: "uppercase",
    borderWidth: 1, borderColor: COLORS.amber,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  communityReviewBody: {
    fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New",
    lineHeight: 16, fontStyle: "italic",
  },

  editBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 12, alignItems: "center", marginBottom: 8,
  },
  editBtnText: { fontSize: 11, color: COLORS.textPrimary, fontFamily: "Courier New", letterSpacing: 2 },
  deleteBtn: {
    borderWidth: 1, borderColor: COLORS.danger,
    paddingVertical: 12, alignItems: "center",
  },
  deleteBtnText: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 2 },
  confirmRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  confirmText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
});
