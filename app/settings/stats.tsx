import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useMemo } from "react";
import { COLORS, BADGES } from "@/constants";
import { useFilmLogStore } from "@/store";
import { computeBadgeStats } from "@/utils/badges";

export default function StatsScreen() {
  const { rolls, personalWalks, completions, myReviews, user } = useFilmLogStore();

  const stats = useMemo(
    () => computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id),
    [rolls, personalWalks, completions, myReviews, user]
  );

  const earnedIds = new Set(BADGES.filter((b) => b.check(stats)).map((b) => b.id));
  const earnedCount = earnedIds.size;

  const STAT_ROWS: { label: string; value: number | string }[] = [
    { label: "Rolls", value: stats.rollCount },
    { label: "Frames", value: stats.frameCount },
    { label: "Film Stocks", value: stats.stockCount },
    { label: "Cameras", value: stats.cameraCount },
    { label: "Locations", value: stats.locationCount },
    { label: "Finished Rolls", value: stats.finishedRolls },
    { label: "Scanned Frames", value: stats.scannedFrames },
    { label: "Rated Frames", value: stats.ratedFrames },
    { label: "Tagged Frames", value: stats.taggedFrames },
    { label: "Unique Tags", value: stats.uniqueTagCount },
    { label: "Filter Types Used", value: `${stats.filterTypesUsed} / 10` },
    { label: "Weather Conditions", value: `${stats.weatherTypesUsed} / 7` },
    { label: "Self-Developed Rolls", value: stats.developedRolls },
    { label: "Push-Processed Rolls", value: stats.pushedRolls },
    { label: "Walks Completed", value: stats.completedWalks },
    { label: "Walks Rated", value: stats.walksRated },
    { label: "Badges Earned", value: `${earnedCount} / ${BADGES.length}` },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Overview */}
      <Text style={s.sectionLabel}>Overview</Text>
      <View style={s.statsCard}>
        {STAT_ROWS.map(({ label, value }, i) => (
          <View key={label} style={[s.statRow, i < STAT_ROWS.length - 1 && s.statRowBorder]}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Badges */}
      <Text style={[s.sectionLabel, { marginTop: 28 }]}>Badges</Text>
      <Text style={s.badgeCount}>
        {earnedCount} / {BADGES.length} earned
      </Text>
      <View style={s.badgeGrid}>
        {BADGES.map((badge) => {
          const earned = earnedIds.has(badge.id);
          return (
            <View key={badge.id} style={[s.badgeCard, !earned && s.badgeCardLocked]}>
              <Text style={[s.badgeEmoji, !earned && s.badgeEmojiLocked]}>{badge.emoji}</Text>
              <Text style={[s.badgeName, !earned && s.badgeNameLocked]} numberOfLines={1}>
                {badge.name}
              </Text>
              <Text style={s.badgeDesc} numberOfLines={2}>
                {badge.description}
              </Text>
              {earned && <Text style={s.badgeEarned}>EARNED</Text>}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  statsCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
  },
  statRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16,
  },
  statRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
  statValue: { fontSize: 15, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold" },

  badgeCount: {
    fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New",
    marginBottom: 12, letterSpacing: 0.5,
  },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  badgeCard: {
    width: "47%", backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, alignItems: "center",
  },
  badgeCardLocked: { borderColor: COLORS.borderSubtle, opacity: 0.45 },
  badgeEmoji: { fontSize: 28, marginBottom: 6 },
  badgeEmojiLocked: { opacity: 0.5 },
  badgeName: {
    fontSize: 11, color: COLORS.textPrimary, fontFamily: "Courier New",
    fontWeight: "bold", marginBottom: 4, textAlign: "center",
  },
  badgeNameLocked: { color: COLORS.textMuted },
  badgeDesc: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    textAlign: "center", lineHeight: 14,
  },
  badgeEarned: {
    fontSize: 7, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 2, marginTop: 8, textTransform: "uppercase",
  },
});
