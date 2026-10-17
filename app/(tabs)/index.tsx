import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { formatDate, rollProgress, statusColors } from "@/utils";
import { Roll } from "@/types";

export default function RollsScreen() {
  const router = useRouter();
  const { rolls, cameras, filmStocks, hydrated } = useFilmLogStore();

  if (!hydrated) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.amber} />
      </View>
    );
  }

  const getCameraName = (id: string) =>
    cameras.find((c) => c.id === id)?.name ?? id;

  const getFilmName = (id: string) =>
    filmStocks.find((f) => f.id === id)?.name ?? id;

  // Stats
  const active = rolls.filter((r) => r.status === "Shooting").length;
  const atLab = rolls.filter((r) => r.status === "At Lab").length;
  const totalShots = rolls.reduce((n, r) => n + r.shots.length, 0);

  const renderRoll = ({ item }: { item: Roll }) => {
    const { bg, fg } = statusColors(item.status);
    const progress = rollProgress(item.shots.length, item.frameCount);
    const filmName = getFilmName(item.filmStockId);
    const cameraName = getCameraName(item.cameraId);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/roll/${item.id}`)}
        activeOpacity={0.75}
      >
        <View style={s.cardHeader}>
          <View style={s.cardLeft}>
            {item.name && <Text style={s.rollName}>{item.name}</Text>}
            <Text style={s.filmName}>{filmName}</Text>
            <Text style={s.meta}>{cameraName} · ISO {item.iso}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.shotCount}>{item.shots.length}</Text>
            <Text style={s.shotLabel}>/ {item.frameCount} exp</Text>
          </View>
        </View>
        <View style={s.cardFooter}>
          <View style={[s.badge, { backgroundColor: bg, borderColor: fg }]}>
            <Text style={[s.badgeText, { color: fg }]}>{item.status}</Text>
          </View>
          <Text style={s.date}>Loaded {formatDate(item.loadedAt)}</Text>
          {item.isPublic && (
            <View style={s.publicBadge}>
              <Text style={s.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
        {/* Progress bar */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Stats strip */}
      <View style={s.statsRow}>
        {[
          [rolls.length, "Rolls"],
          [active, "Shooting"],
          [atLab, "At Lab"],
          [totalShots, "Frames"],
        ].map(([n, label]) => (
          <View key={String(label)} style={s.stat}>
            <Text style={s.statNum}>{n}</Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={rolls}
        keyExtractor={(r) => r.id}
        renderItem={renderRoll}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎞</Text>
            <Text style={s.emptyText}>No rolls loaded yet.{"\n"}Tap + to start.</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => router.push("/roll/new")}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 24,
  },
  stat: {},
  statNum: { fontSize: 18, fontWeight: "bold", color: COLORS.amber, fontFamily: "Courier New" },
  statLabel: { fontSize: 9, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Courier New" },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  rollName: { fontSize: 11, color: COLORS.amber, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2, fontFamily: "Courier New" },
  filmName: { fontSize: 14, fontWeight: "bold", color: COLORS.textPrimary, fontFamily: "Courier New" },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontFamily: "Courier New" },
  shotCount: { fontSize: 22, fontWeight: "bold", color: COLORS.amber, fontFamily: "Courier New" },
  shotLabel: { fontSize: 9, color: COLORS.textDim, letterSpacing: 1, fontFamily: "Courier New" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Courier New" },
  date: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New" },
  publicBadge: { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: 6, paddingVertical: 2 },
  publicBadgeText: { fontSize: 8, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
  progressBg: { height: 2, backgroundColor: COLORS.bgElevated },
  progressFill: { height: "100%", backgroundColor: COLORS.amber },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 12, color: COLORS.textDim, textAlign: "center", lineHeight: 20, fontFamily: "Courier New", letterSpacing: 1 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amber,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: COLORS.amber,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 28, color: COLORS.bg, fontWeight: "bold", lineHeight: 32 },
});
