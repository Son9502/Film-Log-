import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";

type GeoShot = {
  shotId: string;
  rollId: string;
  rollName: string;
  frame: number;
  latitude: number;
  longitude: number;
  locationLabel?: string;
};

export default function MapScreen() {
  const router = useRouter();
  const { rolls, filmStocks } = useFilmLogStore();

  // Collect every shot that has GPS data across all rolls
  const geoShots: GeoShot[] = rolls.flatMap((roll) => {
    const filmName = filmStocks.find((f) => f.id === roll.filmStockId)?.name ?? roll.filmStockId;
    const rollLabel = roll.name ?? filmName;
    return roll.shots
      .filter((s) => s.location)
      .map((s) => ({
        shotId: s.id,
        rollId: roll.id,
        rollName: rollLabel,
        frame: s.frame,
        latitude: s.location!.latitude,
        longitude: s.location!.longitude,
        locationLabel: s.locationLabel,
      }));
  });

  const region = (() => {
    if (!geoShots.length) return null;
    const lats = geoShots.map((s) => s.latitude);
    const lngs = geoShots.map((s) => s.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 0.01;
    return {
      latitude:  (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta:  Math.max(maxLat - minLat, pad) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, pad) * 1.4,
    };
  })();

  if (!geoShots.length) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>📍</Text>
        <Text style={s.emptyTitle}>No tagged shots yet</Text>
        <Text style={s.emptySub}>
          GPS is captured automatically when you log a frame.{"\n"}
          You can also add a location label manually per frame or roll.
        </Text>
      </View>
    );
  }

  // Web: react-native-maps is stubbed — show a grouped list instead
  if (Platform.OS === "web") {
    const byRoll = rolls
      .map((roll) => {
        const shots = geoShots.filter((g) => g.rollId === roll.id);
        return shots.length ? { roll, shots } : null;
      })
      .filter(Boolean) as { roll: (typeof rolls)[0]; shots: GeoShot[] }[];

    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Shot Map</Text>
          <Text style={s.headerSub}>{geoShots.length} tagged frame{geoShots.length !== 1 ? "s" : ""}</Text>
        </View>
        <ScrollView contentContainerStyle={s.listContent}>
          {byRoll.map(({ roll, shots }) => (
            <View key={roll.id} style={s.rollGroup}>
              <TouchableOpacity onPress={() => router.push(`/roll/${roll.id}`)}>
                <Text style={s.rollGroupName}>{shots[0].rollName}</Text>
              </TouchableOpacity>
              {shots.map((g) => (
                <TouchableOpacity
                  key={g.shotId}
                  style={s.listRow}
                  onPress={() => router.push(`/roll/${roll.id}`)}
                >
                  <Text style={s.listFrame}>Frame {String(g.frame).padStart(2, "0")}</Text>
                  <Text style={s.listCoord}>
                    {g.locationLabel || `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Native: full MapView
  return (
    <View style={s.container}>
      {region && (
        <MapView style={s.map} initialRegion={region}>
          {geoShots.map((g) => (
            <Marker
              key={g.shotId}
              coordinate={{ latitude: g.latitude, longitude: g.longitude }}
              onPress={() => router.push(`/roll/${g.rollId}`)}
            >
              <View style={s.bubble}>
                <Text style={s.bubbleRoll} numberOfLines={1}>{g.rollName}</Text>
                <Text style={s.bubbleFrame}>{String(g.frame).padStart(2, "0")}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}
      <View style={s.pill}>
        <Text style={s.pillText}>{geoShots.length} frame{geoShots.length !== 1 ? "s" : ""} tagged</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  empty: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: {
    fontSize: 12, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
  },
  emptySub: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New",
    textAlign: "center", lineHeight: 18,
  },

  map: { flex: 1 },

  bubble: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.amber,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: 120,
  },
  bubbleRoll: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  bubbleFrame: {
    fontSize: 13, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold",
  },

  pill: {
    position: "absolute", bottom: 24, alignSelf: "center",
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pillText: {
    fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase",
  },

  // Web list styles
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 11, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 3, textTransform: "uppercase",
  },
  headerSub: {
    fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2,
  },
  listContent: { padding: 16, paddingBottom: 40 },
  rollGroup: { marginBottom: 24 },
  rollGroupName: {
    fontSize: 11, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
  },
  listRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  listFrame: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New" },
  listCoord: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New" },
});
