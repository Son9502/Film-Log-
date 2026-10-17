import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, FlatList, StyleSheet, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS, FRAME_COUNT_OPTIONS } from "@/constants";
import { uid, todayISO } from "@/utils";

// ── Generic picker modal ──────────────────────────────────────────────────────

function PickerModal<T extends { id: string; name: string }>({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  renderSub,
}: {
  visible: boolean;
  title: string;
  items: T[];
  selectedId: string;
  onSelect: (item: T) => void;
  onClose: () => void;
  renderSub?: (item: T) => string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.sheetTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[m.option, item.id === selectedId && m.optionSelected]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[m.optionText, item.id === selectedId && m.optionTextSelected]}>
                  {item.name}
                </Text>
                {renderSub && (
                  <Text style={m.optionSub}>{renderSub(item)}</Text>
                )}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── New Roll Screen ───────────────────────────────────────────────────────────

export default function NewRollScreen() {
  const router = useRouter();
  const { cameras, filmStocks, addRoll } = useFilmLogStore();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [cameraId, setCameraId] = useState(cameras[0]?.id ?? "");
  const [filmStockId, setFilmStockId] = useState(filmStocks[0]?.id ?? "");
  const [frameCount, setFrameCount] = useState(36);
  const [customFrames, setCustomFrames] = useState("");
  const [useCustomFrames, setUseCustomFrames] = useState(false);

  const [isPublic, setIsPublic] = useState(false);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  const [filmPickerOpen, setFilmPickerOpen] = useState(false);

  const selectedCamera = cameras.find((c) => c.id === cameraId);
  const selectedFilm = filmStocks.find((f) => f.id === filmStockId);

  const resolvedFrameCount = useCustomFrames ? (parseInt(customFrames) || 0) : frameCount;

  function handleSubmit() {
    if (resolvedFrameCount <= 0) return;
    addRoll({
      id: uid(),
      name: name.trim() || undefined,
      cameraId,
      filmStockId,
      iso: selectedFilm?.iso.toString() ?? "400",
      frameCount: resolvedFrameCount,
      status: "Stock",
      shots: [],
      isPublic,
      loadedAt: todayISO(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    router.back();
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* Roll Name */}
      <Text style={s.label}>Roll Name (optional)</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Yosemite Trip"
        placeholderTextColor={COLORS.textDim}
      />

      {/* Camera */}
      <Text style={s.label}>Camera</Text>
      <TouchableOpacity style={s.picker} onPress={() => setCameraPickerOpen(true)}>
        <Text style={s.pickerText}>{selectedCamera?.name ?? "Select camera"}</Text>
        <Text style={s.pickerArrow}>›</Text>
      </TouchableOpacity>

      {/* Film Stock */}
      <Text style={s.label}>Film Stock</Text>
      <TouchableOpacity style={s.picker} onPress={() => setFilmPickerOpen(true)}>
        <View>
          <Text style={s.pickerText}>{selectedFilm?.name ?? "Select film stock"}</Text>
          {selectedFilm && (
            <Text style={s.pickerSub}>ISO {selectedFilm.iso}</Text>
          )}
        </View>
        <Text style={s.pickerArrow}>›</Text>
      </TouchableOpacity>

      {/* Frame Count */}
      <Text style={s.label}>Frame Count</Text>
      <View style={s.segmented}>
        {FRAME_COUNT_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.segment, !useCustomFrames && frameCount === n && s.segmentActive]}
            onPress={() => { setFrameCount(n); setUseCustomFrames(false); }}
          >
            <Text style={[s.segmentText, !useCustomFrames && frameCount === n && s.segmentTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.segment, useCustomFrames && s.segmentActive]}
          onPress={() => setUseCustomFrames(true)}
        >
          <Text style={[s.segmentText, useCustomFrames && s.segmentTextActive]}>Other</Text>
        </TouchableOpacity>
      </View>
      {useCustomFrames && (
        <TextInput
          style={[s.input, { marginTop: 8 }]}
          value={customFrames}
          onChangeText={setCustomFrames}
          placeholder="e.g. 27"
          placeholderTextColor={COLORS.textDim}
          keyboardType="number-pad"
        />
      )}

      {/* Notes */}
      <Text style={s.label}>Notes (optional)</Text>
      <TextInput
        style={[s.input, s.inputMulti]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any notes about this roll..."
        placeholderTextColor={COLORS.textDim}
        multiline
        numberOfLines={3}
      />

      {/* Visibility */}
      <Text style={s.label}>Visibility</Text>
      <View style={s.toggleRow}>
        <View>
          <Text style={s.toggleLabel}>Public roll</Text>
          <Text style={s.toggleSub}>Visible to others on your public profile</Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
          thumbColor={isPublic ? COLORS.amber : COLORS.textDim}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity style={s.submitBtn} onPress={handleSubmit}>
        <Text style={s.submitText}>Add to Stock</Text>
      </TouchableOpacity>

      {/* Pickers */}
      <PickerModal
        visible={cameraPickerOpen}
        title="Select Camera"
        items={cameras}
        selectedId={cameraId}
        onSelect={(c) => setCameraId(c.id)}
        onClose={() => setCameraPickerOpen(false)}
      />
      <PickerModal
        visible={filmPickerOpen}
        title="Select Film Stock"
        items={filmStocks}
        selectedId={filmStockId}
        onSelect={(f) => setFilmStockId(f.id)}
        onClose={() => setFilmPickerOpen(false)}
        renderSub={(f) => `ISO ${(f as typeof filmStocks[0]).iso}`}
      />

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 60 },
  label: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 2,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 6, marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  picker: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  pickerSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  pickerArrow: { fontSize: 20, color: COLORS.textDim },
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard,
  },
  segmentActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  segmentText: { fontSize: 13, color: COLORS.textMuted, fontFamily: "Courier New" },
  segmentTextActive: { color: COLORS.textPrimary },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12, marginTop: 0,
  },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  toggleSub: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  submitBtn: {
    marginTop: 32, backgroundColor: COLORS.amber,
    paddingVertical: 14, alignItems: "center",
  },
  submitText: {
    fontSize: 11, color: COLORS.bg, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase",
  },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bgElevated, borderTopWidth: 1,
    borderTopColor: COLORS.border, paddingTop: 20, paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", paddingHorizontal: 20, marginBottom: 12,
  },
  option: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  optionSelected: { backgroundColor: COLORS.bgCard },
  optionText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New" },
  optionTextSelected: { color: COLORS.amber },
  optionSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: "center" },
  cancelText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
});
