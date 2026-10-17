import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet,
} from "react-native";
import { useState, useMemo } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { COLORS, WALK_DIFFICULTIES, WALK_TAG_OPTIONS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { Walk, WalkStop } from "@/types";
import { uid } from "@/utils";

export default function NewWalkScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const router = useRouter();
  const { personalWalks, communityWalks, user, createWalk, updateWalk } = useFilmLogStore();

  const existing = useMemo(
    () => editId
      ? (personalWalks.find((w) => w.id === editId) ?? communityWalks.find((w) => w.id === editId))
      : undefined,
    [editId, personalWalks, communityWalks]
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? "");
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    existing?.estimatedMinutes != null ? String(existing.estimatedMinutes) : ""
  );
  const [distanceKm, setDistanceKm] = useState(
    existing?.distanceKm != null ? String(existing.distanceKm) : ""
  );
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? false);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [stops, setStops] = useState<WalkStop[]>(existing?.stops ?? []);

  // Stop builder state
  const [addingStop, setAddingStop] = useState(false);
  const [stopTitle, setStopTitle] = useState("");
  const [stopDesc, setStopDesc] = useState("");
  const [stopLocation, setStopLocation] = useState("");

  const isEdit = !!existing;
  const canSave = title.trim().length > 0;

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function addStop() {
    if (!stopTitle.trim()) return;
    const newStop: WalkStop = {
      id: uid(),
      walkId: existing?.id ?? "",
      order: stops.length,
      title: stopTitle.trim(),
      description: stopDesc.trim() || undefined,
      locationLabel: stopLocation.trim() || undefined,
    };
    setStops([...stops, newStop]);
    setStopTitle(""); setStopDesc(""); setStopLocation("");
    setAddingStop(false);
  }

  function removeStop(id: string) {
    setStops(stops.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  }

  function moveStop(id: string, dir: -1 | 1) {
    const idx = stops.findIndex((s) => s.id === id);
    if (idx + dir < 0 || idx + dir >= stops.length) return;
    const next = [...stops];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setStops(next.map((s, i) => ({ ...s, order: i })));
  }

  function handleSave() {
    if (!canSave) return;
    const now = new Date().toISOString();
    const walkId = existing?.id ?? uid();
    const walk: Walk = {
      id: walkId,
      title: title.trim(),
      description: description.trim() || undefined,
      city: city.trim() || undefined,
      difficulty: (difficulty as Walk["difficulty"]) || undefined,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
      distanceKm: distanceKm ? parseFloat(distanceKm) : undefined,
      isPublic,
      isFeatured: existing?.isFeatured ?? false,
      createdByUserId: user?.id,
      tags: tags.length > 0 ? tags : undefined,
      stops: stops.map((s) => ({ ...s, walkId })),
      completionCount: existing?.completionCount ?? 0,
      avgRating: existing?.avgRating,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (isEdit) {
      updateWalk(walk);
    } else {
      createWalk(walk);
    }
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? "Edit Walk" : "New Walk" }} />
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Basic info */}
        <Text style={s.sectionLabel}>Details</Text>
        <Text style={s.label}>Title *</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Walk title"
          placeholderTextColor={COLORS.textDim}
        />

        <Text style={s.label}>City</Text>
        <TextInput
          style={s.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. New York, NY"
          placeholderTextColor={COLORS.textDim}
        />

        <Text style={s.label}>Description</Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What makes this walk special?"
          placeholderTextColor={COLORS.textDim}
          multiline
          numberOfLines={3}
        />

        {/* Difficulty */}
        <Text style={s.label}>Difficulty</Text>
        <TouchableOpacity style={s.picker} onPress={() => setDifficultyOpen(!difficultyOpen)}>
          <Text style={difficulty ? s.pickerText : s.pickerPlaceholder}>{difficulty || "Select difficulty"}</Text>
          <Text style={s.pickerArrow}>›</Text>
        </TouchableOpacity>
        {difficultyOpen && (
          <View style={s.pickerList}>
            <TouchableOpacity style={s.pickerItem} onPress={() => { setDifficulty(""); setDifficultyOpen(false); }}>
              <Text style={s.pickerItemText}>— None —</Text>
            </TouchableOpacity>
            {WALK_DIFFICULTIES.map((d) => (
              <TouchableOpacity key={d} style={s.pickerItem} onPress={() => { setDifficulty(d); setDifficultyOpen(false); }}>
                <Text style={[s.pickerItemText, difficulty === d && s.pickerItemActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Time & distance */}
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Est. Minutes</Text>
            <TextInput
              style={s.input}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              placeholder="e.g. 90"
              placeholderTextColor={COLORS.textDim}
              keyboardType="numeric"
            />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Distance (km)</Text>
            <TextInput
              style={s.input}
              value={distanceKm}
              onChangeText={setDistanceKm}
              placeholder="e.g. 3.5"
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Public toggle */}
        <View style={s.toggleRow}>
          <View>
            <Text style={s.label}>Make Public</Text>
            <Text style={s.toggleSub}>Share with the community</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: COLORS.border, true: COLORS.amber }}
            thumbColor={COLORS.bgCard}
          />
        </View>

        {/* Tags */}
        <Text style={[s.sectionLabel, { marginTop: 20 }]}>Tags</Text>
        <View style={s.tagInputRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add tag, press +"
            placeholderTextColor={COLORS.textDim}
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <TouchableOpacity style={s.addBtn} onPress={addTag} disabled={!tagInput.trim()}>
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.tagSuggestionLabel}>Suggestions</Text>
        <View style={s.tagSuggestions}>
          {WALK_TAG_OPTIONS.filter((t) => !tags.includes(t.toLowerCase())).map((t) => (
            <TouchableOpacity key={t} style={s.suggestion} onPress={() => setTags([...tags, t.toLowerCase()])}>
              <Text style={s.suggestionText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tags.length > 0 && (
          <View style={s.tagChips}>
            {tags.map((t) => (
              <TouchableOpacity key={t} style={s.tagChip} onPress={() => setTags(tags.filter((x) => x !== t))}>
                <Text style={s.tagChipText}>{t}  ×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stops */}
        <Text style={[s.sectionLabel, { marginTop: 20 }]}>Stops ({stops.length})</Text>
        {stops.map((stop, idx) => (
          <View key={stop.id} style={s.stopCard}>
            <View style={s.stopNum}><Text style={s.stopNumText}>{idx + 1}</Text></View>
            <View style={s.stopBody}>
              <Text style={s.stopTitle}>{stop.title}</Text>
              {stop.locationLabel && <Text style={s.stopMeta}>📍 {stop.locationLabel}</Text>}
              {stop.description && <Text style={s.stopDesc}>{stop.description}</Text>}
            </View>
            <View style={s.stopActions}>
              <TouchableOpacity onPress={() => moveStop(stop.id, -1)} disabled={idx === 0}>
                <Text style={[s.moveBtn, idx === 0 && s.moveBtnDisabled]}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveStop(stop.id, 1)} disabled={idx === stops.length - 1}>
                <Text style={[s.moveBtn, idx === stops.length - 1 && s.moveBtnDisabled]}>↓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeStop(stop.id)}>
                <Text style={s.removeStop}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {addingStop ? (
          <View style={s.addStopForm}>
            <Text style={s.label}>Stop Title *</Text>
            <TextInput
              style={s.input}
              value={stopTitle}
              onChangeText={setStopTitle}
              placeholder="e.g. The Corner Mural"
              placeholderTextColor={COLORS.textDim}
            />
            <Text style={s.label}>Location Label</Text>
            <TextInput
              style={s.input}
              value={stopLocation}
              onChangeText={setStopLocation}
              placeholder="e.g. Houston St & Broadway"
              placeholderTextColor={COLORS.textDim}
            />
            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={stopDesc}
              onChangeText={setStopDesc}
              placeholder="What to look for / shoot here"
              placeholderTextColor={COLORS.textDim}
              multiline
              numberOfLines={2}
            />
            <View style={s.addStopActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddingStop(false); setStopTitle(""); setStopDesc(""); setStopLocation(""); }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveStopBtn, !stopTitle.trim() && s.saveBtnDisabled]} onPress={addStop} disabled={!stopTitle.trim()}>
                <Text style={s.saveStopText}>Add Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.addStopBtn} onPress={() => setAddingStop(true)}>
            <Text style={s.addStopBtnText}>+ Add Stop</Text>
          </TouchableOpacity>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={s.saveBtnText}>{isEdit ? "Save Changes" : "Create Walk"}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 12, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5,
  },

  input: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  textArea: { minHeight: 70, textAlignVertical: "top" },

  picker: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4,
  },
  pickerText: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New" },
  pickerPlaceholder: { fontSize: 12, color: COLORS.textDim, fontFamily: "Courier New" },
  pickerArrow: { fontSize: 16, color: COLORS.textDim },
  pickerList: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 14,
  },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  pickerItemText: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New" },
  pickerItemActive: { color: COLORS.amber },

  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },

  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
    marginBottom: 8,
  },
  toggleSub: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },

  tagInputRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  addBtn: {
    width: 42, backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  addBtnText: { fontSize: 20, color: COLORS.amber },
  tagSuggestionLabel: {
    fontSize: 8, color: COLORS.textDim, fontFamily: "Courier New",
    letterSpacing: 1, marginBottom: 6,
  },
  tagSuggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  suggestion: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.borderSubtle,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  suggestionText: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New" },
  tagChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  tagChip: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.amber,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagChipText: { fontSize: 9, color: COLORS.amber, fontFamily: "Courier New" },

  stopCard: {
    flexDirection: "row", backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.borderSubtle, marginBottom: 6,
  },
  stopNum: {
    width: 32, backgroundColor: COLORS.bgElevated,
    alignItems: "center", justifyContent: "center",
  },
  stopNumText: { fontSize: 12, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold" },
  stopBody: { flex: 1, padding: 10 },
  stopTitle: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New", fontWeight: "bold" },
  stopMeta: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },
  stopDesc: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 3 },
  stopActions: { padding: 8, gap: 6, alignItems: "center", justifyContent: "center" },
  moveBtn: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New", padding: 2 },
  moveBtnDisabled: { opacity: 0.3 },
  removeStop: { fontSize: 12, color: COLORS.danger, fontFamily: "Courier New", padding: 2 },

  addStopBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed",
    paddingVertical: 12, alignItems: "center", marginBottom: 20,
  },
  addStopBtnText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  addStopForm: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 20,
  },
  addStopActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { borderWidth: 1, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  saveStopBtn: { backgroundColor: COLORS.amber, paddingVertical: 10, paddingHorizontal: 16 },
  saveStopText: { fontSize: 10, color: COLORS.bg, fontFamily: "Courier New", letterSpacing: 1, fontWeight: "bold" },

  saveBtn: {
    backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center", marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 12, color: COLORS.bg, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold",
  },
});
