import { useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { formatDate } from "@/utils";

interface LocationEntry {
  label: string;
  shotCount: number;
  rollCount: number;
  earliestDate: string;
  coords?: { latitude: number; longitude: number };
}

export default function JournalScreen() {
  const router = useRouter();
  const { rolls, journals } = useFilmLogStore();

  const entries = useMemo((): LocationEntry[] => {
    const map = new Map<string, {
      label: string;
      shotCount: number;
      rollIds: Set<string>;
      earliestDate: string;
      coords?: { latitude: number; longitude: number };
    }>();

    for (const roll of rolls) {
      for (const shot of roll.shots) {
        const label = (shot.locationLabel ?? roll.locationLabel)?.trim();
        if (!label) continue;
        const key = label.toLowerCase();
        const date = shot.timestamp ?? roll.loadedAt;
        if (!map.has(key)) {
          map.set(key, { label, shotCount: 0, rollIds: new Set(), earliestDate: date });
        }
        const e = map.get(key)!;
        e.shotCount++;
        e.rollIds.add(roll.id);
        if (date < e.earliestDate) e.earliestDate = date;
        if (!e.coords && shot.location) e.coords = shot.location;
      }
      // Roll with location label but no shots still gets an entry
      if (roll.locationLabel && roll.shots.length === 0) {
        const key = roll.locationLabel.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            label: roll.locationLabel.trim(), shotCount: 0,
            rollIds: new Set([roll.id]), earliestDate: roll.loadedAt,
          });
        } else {
          map.get(key)!.rollIds.add(roll.id);
        }
      }
    }

    return Array.from(map.values())
      .map((e) => ({
        label: e.label,
        shotCount: e.shotCount,
        rollCount: e.rollIds.size,
        earliestDate: e.earliestDate,
        coords: e.coords,
      }))
      .sort((a, b) => b.earliestDate.localeCompare(a.earliestDate));
  }, [rolls]);

  const journalByLabel = useMemo(() => {
    const m = new Map<string, typeof journals[0]>();
    for (const j of journals) m.set(j.locationLabel.toLowerCase().trim(), j);
    return m;
  }, [journals]);

  if (entries.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No locations yet</Text>
        <Text style={s.emptySub}>
          Add a location label to a roll or frame to start your journal.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={s.list}
      data={entries}
      keyExtractor={(item) => item.label.toLowerCase()}
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <Text style={s.header}>
          {entries.length} location{entries.length !== 1 ? "s" : ""}
        </Text>
      }
      renderItem={({ item }) => {
        const journal = journalByLabel.get(item.label.toLowerCase().trim());
        const hasBody = !!(journal?.body?.trim());
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              router.push({ pathname: "/journal/[label]", params: { label: item.label } })
            }
            activeOpacity={0.7}
          >
            <View style={s.cardTop}>
              <Text style={s.locationName} numberOfLines={1}>{item.label}</Text>
              {hasBody && <Text style={s.dot}>●</Text>}
            </View>
            {hasBody && (
              <Text style={s.bodyPreview} numberOfLines={2}>{journal!.body}</Text>
            )}
            <Text style={s.meta}>
              {[
                item.shotCount > 0 && `${item.shotCount} frame${item.shotCount !== 1 ? "s" : ""}`,
                item.rollCount > 0 && `${item.rollCount} roll${item.rollCount !== 1 ? "s" : ""}`,
                formatDate(item.earliestDate),
              ].filter(Boolean).join("  ·  ")}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 80 },

  header: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 6,
  },
  locationName: {
    fontSize: 14, color: COLORS.textPrimary, fontFamily: "Courier New", flex: 1,
  },
  dot: { fontSize: 8, color: COLORS.amber, marginTop: 4, marginLeft: 10 },
  bodyPreview: {
    fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New",
    lineHeight: 17, marginBottom: 8, fontStyle: "italic",
  },
  meta: {
    fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 0.3,
  },

  empty: {
    flex: 1, backgroundColor: COLORS.bg,
    justifyContent: "center", alignItems: "center", padding: 32,
  },
  emptyTitle: {
    fontSize: 13, color: COLORS.textMuted, fontFamily: "Courier New", marginBottom: 10,
  },
  emptySub: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New",
    textAlign: "center", lineHeight: 18,
  },
});
