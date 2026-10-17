import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { Walk } from "@/types";

type Section = "mine" | "community" | "recommended";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: COLORS.success,
  Moderate: COLORS.amber,
  Challenging: COLORS.danger,
};

function WalkCard({ walk, isCompleted, onPress }: { walk: Walk; isCompleted: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={wc.card} onPress={onPress} activeOpacity={0.7}>
      <View style={wc.cardTop}>
        <Text style={wc.title} numberOfLines={1}>{walk.title}</Text>
        {isCompleted && <Text style={wc.completedBadge}>✓ Done</Text>}
      </View>
      {walk.city && <Text style={wc.city}>{walk.city}</Text>}
      {walk.description && (
        <Text style={wc.desc} numberOfLines={2}>{walk.description}</Text>
      )}

      <View style={wc.metaRow}>
        {walk.difficulty && (
          <Text style={[wc.difficulty, { color: DIFFICULTY_COLOR[walk.difficulty] ?? COLORS.textMuted }]}>
            {walk.difficulty}
          </Text>
        )}
        {walk.estimatedMinutes != null && (
          <Text style={wc.meta}>{walk.estimatedMinutes} min</Text>
        )}
        {walk.distanceKm != null && (
          <Text style={wc.meta}>{walk.distanceKm} km</Text>
        )}
        <Text style={wc.meta}>{walk.stops.length} stops</Text>
        {walk.completionCount > 0 && (
          <Text style={wc.meta}>{walk.completionCount} completed</Text>
        )}
        {walk.avgRating != null && (
          <Text style={wc.meta}>{"★".repeat(Math.round(walk.avgRating))}</Text>
        )}
      </View>

      {walk.tags && walk.tags.length > 0 && (
        <View style={wc.tagRow}>
          {walk.tags.slice(0, 4).map((t) => (
            <View key={t} style={wc.tag}>
              <Text style={wc.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function WalksScreen() {
  const router = useRouter();
  const { personalWalks, communityWalks, completions, fetchCommunityWalks, user } = useFilmLogStore();
  const [section, setSection] = useState<Section>("mine");
  const [refreshing, setRefreshing] = useState(false);

  const completedWalkIds = new Set(completions.map((c) => c.walkId));

  const recommended = communityWalks.filter((w) => w.isFeatured);
  const community = communityWalks.filter(
    (w) => !w.isFeatured && w.createdByUserId !== user?.id
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCommunityWalks();
    setRefreshing(false);
  }, [fetchCommunityWalks]);

  const activeList: Walk[] =
    section === "mine" ? personalWalks :
    section === "community" ? community :
    recommended;

  const emptyMessages: Record<Section, string> = {
    mine: "No walks yet.\nTap + to create your first walk.",
    community: "No community walks found.\nPull to refresh.",
    recommended: "No recommended walks yet.\nCheck back soon.",
  };

  return (
    <View style={s.container}>
      {/* Section tabs */}
      <View style={s.segmentRow}>
        {(["mine", "community", "recommended"] as Section[]).map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[s.segment, section === sec && s.segmentActive]}
            onPress={() => {
              setSection(sec);
              if (sec !== "mine" && communityWalks.length === 0) fetchCommunityWalks();
            }}
          >
            <Text style={[s.segmentText, section === sec && s.segmentTextActive]}>
              {sec === "mine" ? "My Walks" : sec === "community" ? "Community" : "Recommended"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={activeList}
        keyExtractor={(w) => w.id}
        contentContainerStyle={s.list}
        refreshControl={
          section !== "mine"
            ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.amber} />
            : undefined
        }
        renderItem={({ item }) => (
          <WalkCard
            walk={item}
            isCompleted={completedWalkIds.has(item.id)}
            onPress={() => router.push({ pathname: "/walks/[id]", params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{emptyMessages[section]}</Text>
          </View>
        }
      />

      {/* FAB — only shown on My Walks */}
      {section === "mine" && (
        <TouchableOpacity style={s.fab} onPress={() => router.push("/walks/new")}>
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 90 },

  segmentRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  segment: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  segmentActive: { borderBottomColor: COLORS.amber },
  segmentText: {
    fontSize: 9, color: COLORS.textMuted,
    fontFamily: "Courier New", letterSpacing: 1.5, textTransform: "uppercase",
  },
  segmentTextActive: { color: COLORS.amber },

  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: {
    fontSize: 12, color: COLORS.textDim, fontFamily: "Courier New",
    textAlign: "center", lineHeight: 20,
  },

  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.amber, alignItems: "center", justifyContent: "center",
  },
  fabText: { fontSize: 26, color: COLORS.bg, fontWeight: "bold", lineHeight: 30 },
});

const wc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  title: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold" },
  completedBadge: {
    fontSize: 9, color: COLORS.success, fontFamily: "Courier New",
    letterSpacing: 1, marginLeft: 8,
  },
  city: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 0.5, marginBottom: 6 },
  desc: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  meta: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 0.5 },
  difficulty: { fontSize: 9, fontFamily: "Courier New", letterSpacing: 0.5, fontWeight: "bold" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New" },
});
