import { useState, useMemo, useEffect } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { uid } from "@/utils";
import { Shot } from "@/types";

interface LocShot {
  shot: Shot;
  rollId: string;
  rollName?: string;
  filmStockName: string;
  rollLoadedAt: string;
}

export default function LocationJournalScreen() {
  const params = useLocalSearchParams<{ label: string }>();
  const locationLabel = Array.isArray(params.label) ? params.label[0] : (params.label ?? "");
  const router = useRouter();
  const { rolls, filmStocks, journals, upsertJournal, deleteJournal } = useFilmLogStore();

  const journal = useMemo(
    () => journals.find((j) => j.locationLabel.toLowerCase() === locationLabel.toLowerCase()),
    [journals, locationLabel],
  );

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(journal?.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep body in sync when remote sync updates the journal
  useEffect(() => {
    if (!editing) setBody(journal?.body ?? "");
  }, [journal?.body, editing]);

  const locShots = useMemo((): LocShot[] => {
    const target = locationLabel.toLowerCase().trim();
    const results: LocShot[] = [];

    for (const roll of rolls) {
      const film = filmStocks.find((f) => f.id === roll.filmStockId);
      const rollMatches = roll.locationLabel?.toLowerCase().trim() === target;

      for (const shot of roll.shots) {
        const shotMatches = shot.locationLabel?.toLowerCase().trim() === target;
        // Include if: shot has this label, OR roll has this label and shot has no label
        if (shotMatches || (rollMatches && !shot.locationLabel)) {
          results.push({
            shot,
            rollId: roll.id,
            rollName: roll.name,
            filmStockName: film?.name ?? roll.filmStockId,
            rollLoadedAt: roll.loadedAt,
          });
        }
      }
    }

    return results.sort((a, b) => {
      const aDate = a.shot.timestamp ?? a.rollLoadedAt;
      const bDate = b.shot.timestamp ?? b.rollLoadedAt;
      return aDate.localeCompare(bDate);
    });
  }, [rolls, filmStocks, locationLabel]);

  const rollCount = useMemo(
    () => new Set(locShots.map((s) => s.rollId)).size,
    [locShots],
  );

  const representativeCoords = locShots.find((s) => s.shot.location)?.shot.location;

  function handleSave() {
    const now = new Date().toISOString();
    upsertJournal({
      id: journal?.id ?? uid(),
      locationLabel,
      body: body.trim() || undefined,
      latitude: representativeCoords?.latitude ?? journal?.latitude,
      longitude: representativeCoords?.longitude ?? journal?.longitude,
      createdAt: journal?.createdAt ?? now,
      updatedAt: now,
    });
    setEditing(false);
  }

  function handleCancel() {
    setBody(journal?.body ?? "");
    setEditing(false);
  }

  function handleDelete() {
    if (journal) deleteJournal(journal.id);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: locationLabel }} />
      <FlatList
        style={s.container}
        data={locShots}
        keyExtractor={(item) => item.shot.id}
        contentContainerStyle={s.content}
        ListHeaderComponent={(
          <View>
            {/* Stats row */}
            <View style={s.statsRow}>
              <Text style={s.statVal}>{locShots.length}</Text>
              <Text style={s.statLabel}>frame{locShots.length !== 1 ? "s" : ""}</Text>
              {rollCount > 0 && (
                <>
                  <View style={s.statDivider} />
                  <Text style={s.statVal}>{rollCount}</Text>
                  <Text style={s.statLabel}>roll{rollCount !== 1 ? "s" : ""}</Text>
                </>
              )}
            </View>

            {/* Journal body */}
            <View style={s.journalCard}>
              <View style={s.journalHeader}>
                <Text style={s.journalLabel}>Notes</Text>
                {!editing ? (
                  <TouchableOpacity onPress={() => setEditing(true)}>
                    <Text style={s.actionLink}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.editActions}>
                    <TouchableOpacity onPress={handleCancel}>
                      <Text style={s.cancelLink}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave}>
                      <Text style={s.saveLink}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {editing ? (
                <TextInput
                  style={s.bodyInput}
                  value={body}
                  onChangeText={setBody}
                  placeholder="Write about this location…"
                  placeholderTextColor={COLORS.textDim}
                  multiline
                  autoFocus
                />
              ) : body ? (
                <Text style={s.bodyText}>{body}</Text>
              ) : (
                <Text style={s.bodyPlaceholder}>
                  No notes yet — tap Edit to write about this location.
                </Text>
              )}

              {/* Delete journal entry */}
              {journal && !editing && (
                <View style={s.deleteRow}>
                  {confirmDelete ? (
                    <>
                      <Text style={s.deleteConfirm}>Delete notes?</Text>
                      <TouchableOpacity onPress={handleDelete}>
                        <Text style={s.deleteYes}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setConfirmDelete(false)}>
                        <Text style={s.deleteNo}>No</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => setConfirmDelete(true)}>
                      <Text style={s.deleteLink}>Delete notes</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Frames header */}
            {locShots.length > 0 && (
              <Text style={s.sectionTitle}>
                Frames — {locShots.length}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <Text style={s.empty}>No frames logged at this location.</Text>
        )}
        renderItem={({ item, index }) => {
          const prevItem = locShots[index - 1];
          const date = item.shot.timestamp ?? item.rollLoadedAt;
          const prevDate = prevItem ? (prevItem.shot.timestamp ?? prevItem.rollLoadedAt) : null;
          const showDateSep = !prevDate || date.slice(0, 10) !== prevDate.slice(0, 10);

          return (
            <>
              {showDateSep && (
                <Text style={s.dateSep}>{date.slice(0, 10)}</Text>
              )}
              <TouchableOpacity
                style={s.shotRow}
                onPress={() => router.push(`/roll/${item.rollId}`)}
                activeOpacity={0.7}
              >
                <View style={s.shotNum}>
                  <Text style={s.shotNumText}>{String(item.shot.frame).padStart(2, "0")}</Text>
                </View>
                <View style={s.shotBody}>
                  <Text style={s.shotFilm} numberOfLines={1}>
                    {item.filmStockName}{item.rollName ? `  —  ${item.rollName}` : ""}
                  </Text>
                  {(item.shot.shutter || item.shot.aperture) && (
                    <Text style={s.shotExposure}>
                      {[item.shot.shutter, item.shot.aperture].filter(Boolean).join("  ·  ")}
                    </Text>
                  )}
                  {item.shot.subject && <Text style={s.shotSubject}>{item.shot.subject}</Text>}
                  {item.shot.notes && <Text style={s.shotNotes}>{item.shot.notes}</Text>}
                  {item.shot.timestamp && (
                    <Text style={s.shotTime}>{item.shot.timestamp.slice(11)}</Text>
                  )}
                </View>
                <Text style={s.shotArrow}>›</Text>
              </TouchableOpacity>
            </>
          );
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 80 },

  statsRow: {
    flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 20,
    paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statVal: {
    fontSize: 24, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold",
  },
  statLabel: {
    fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New",
    textTransform: "uppercase", letterSpacing: 1, marginRight: 8,
  },
  statDivider: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 },

  journalCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 20,
  },
  journalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  journalLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New",
  },
  editActions: { flexDirection: "row", gap: 14 },
  actionLink: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
  cancelLink: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  saveLink: { fontSize: 10, color: COLORS.success, fontFamily: "Courier New", letterSpacing: 1 },

  bodyInput: {
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    lineHeight: 22, minHeight: 100, textAlignVertical: "top",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
    padding: 10,
  },
  bodyText: {
    fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New", lineHeight: 22,
  },
  bodyPlaceholder: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", fontStyle: "italic",
  },

  deleteRow: {
    flexDirection: "row", gap: 12, alignItems: "center",
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle,
  },
  deleteConfirm: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New" },
  deleteLink: { fontSize: 10, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 0.5 },
  deleteYes: { fontSize: 10, color: COLORS.danger, fontFamily: "Courier New" },
  deleteNo: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New" },

  sectionTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  empty: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 4 },

  dateSep: {
    fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New",
    letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 4,
  },
  shotRow: {
    flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  shotNum: {
    width: 38, height: 38, backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  shotNumText: { fontSize: 12, color: COLORS.amberDim, fontFamily: "Courier New", fontWeight: "bold" },
  shotBody: { flex: 1, paddingTop: 2 },
  shotFilm: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginBottom: 2 },
  shotExposure: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  shotSubject: { fontSize: 11, color: COLORS.textSecondary, fontFamily: "Courier New", marginTop: 2 },
  shotNotes: {
    fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New",
    marginTop: 2, fontStyle: "italic", lineHeight: 15,
  },
  shotTime: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },
  shotArrow: { fontSize: 16, color: COLORS.textDim, alignSelf: "center" },
});
