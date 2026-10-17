import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, StyleSheet,
} from "react-native";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { uid } from "@/utils";
import { Camera, FilmStock } from "@/types";

// ── Add/Edit Camera Modal ─────────────────────────────────────────────────────

function CameraModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial?: Camera;
  onSave: (c: Camera) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");

  function handleSave() {
    if (!name.trim()) return;
    onSave({ id: initial?.id ?? uid(), name: name.trim(), isCustom: true });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>{initial ? "Edit Camera" : "Add Camera"}</Text>
          <Text style={m.label}>Camera Name</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Canon AE-1"
            placeholderTextColor={COLORS.textDim}
            autoFocus
          />
          <View style={m.actions}>
            <TouchableOpacity style={m.btnSecondary} onPress={onClose}>
              <Text style={m.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.btnPrimary} onPress={handleSave}>
              <Text style={m.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Add/Edit Film Stock Modal ─────────────────────────────────────────────────

function FilmModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial?: FilmStock;
  onSave: (f: FilmStock) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [iso, setIso] = useState(initial?.iso?.toString() ?? "");

  function handleSave() {
    if (!name.trim() || !iso.trim()) return;
    onSave({ id: initial?.id ?? uid(), name: name.trim(), iso: parseInt(iso), isCustom: true });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>{initial ? "Edit Film Stock" : "Add Film Stock"}</Text>
          <Text style={m.label}>Film Name</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. CineStill 800T"
            placeholderTextColor={COLORS.textDim}
            autoFocus
          />
          <Text style={m.label}>ISO</Text>
          <TextInput
            style={m.input}
            value={iso}
            onChangeText={setIso}
            placeholder="e.g. 800"
            placeholderTextColor={COLORS.textDim}
            keyboardType="number-pad"
          />
          <View style={m.actions}>
            <TouchableOpacity style={m.btnSecondary} onPress={onClose}>
              <Text style={m.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.btnPrimary} onPress={handleSave}>
              <Text style={m.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GearScreen() {
  const { cameras, filmStocks, addCamera, updateCamera, deleteCamera, addFilmStock, updateFilmStock, deleteFilmStock } =
    useFilmLogStore();

  const [cameraModal, setCameraModal] = useState<{ open: boolean; target?: Camera }>({ open: false });
  const [filmModal, setFilmModal] = useState<{ open: boolean; target?: FilmStock }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<{ type: "camera" | "film"; id: string } | null>(null);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── Cameras ── */}
      <Text style={s.sectionTitle}>Cameras</Text>
      {cameras.map((c) => (
        <View key={c.id} style={s.row}>
          <Text style={s.rowLabel}>{c.name}</Text>
          {c.isCustom ? (
            confirmDelete?.type === "camera" && confirmDelete.id === c.id ? (
              <View style={s.rowActions}>
                <Text style={s.confirmText}>Delete?</Text>
                <TouchableOpacity onPress={() => { deleteCamera(c.id); setConfirmDelete(null); }} style={s.actionBtn}>
                  <Text style={s.actionDelete}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete(null)} style={s.actionBtn}>
                  <Text style={s.actionEdit}>No</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.rowActions}>
                <TouchableOpacity onPress={() => setCameraModal({ open: true, target: c })} style={s.actionBtn}>
                  <Text style={s.actionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete({ type: "camera", id: c.id })} style={s.actionBtn}>
                  <Text style={s.actionDelete}>Delete</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <Text style={s.defaultBadge}>Default</Text>
          )}
        </View>
      ))}
      <TouchableOpacity style={s.addBtn} onPress={() => setCameraModal({ open: true })}>
        <Text style={s.addBtnText}>+ Add Camera</Text>
      </TouchableOpacity>

      {/* ── Film Stocks ── */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>Film Stocks</Text>
      {filmStocks.map((f) => (
        <View key={f.id} style={s.row}>
          <View>
            <Text style={s.rowLabel}>{f.name}</Text>
            <Text style={s.rowSub}>ISO {f.iso}</Text>
          </View>
          {f.isCustom ? (
            confirmDelete?.type === "film" && confirmDelete.id === f.id ? (
              <View style={s.rowActions}>
                <Text style={s.confirmText}>Delete?</Text>
                <TouchableOpacity onPress={() => { deleteFilmStock(f.id); setConfirmDelete(null); }} style={s.actionBtn}>
                  <Text style={s.actionDelete}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete(null)} style={s.actionBtn}>
                  <Text style={s.actionEdit}>No</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.rowActions}>
                <TouchableOpacity onPress={() => setFilmModal({ open: true, target: f })} style={s.actionBtn}>
                  <Text style={s.actionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmDelete({ type: "film", id: f.id })} style={s.actionBtn}>
                  <Text style={s.actionDelete}>Delete</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <Text style={s.defaultBadge}>Default</Text>
          )}
        </View>
      ))}
      <TouchableOpacity style={s.addBtn} onPress={() => setFilmModal({ open: true })}>
        <Text style={s.addBtnText}>+ Add Film Stock</Text>
      </TouchableOpacity>

      {/* ── Modals ── */}
      <CameraModal
        visible={cameraModal.open}
        initial={cameraModal.target}
        onSave={(c) => cameraModal.target ? updateCamera(c) : addCamera(c)}
        onClose={() => setCameraModal({ open: false })}
      />
      <FilmModal
        visible={filmModal.open}
        initial={filmModal.target}
        onSave={(f) => filmModal.target ? updateFilmStock(f) : addFilmStock(f)}
        onClose={() => setFilmModal({ open: false })}
      />

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  rowLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  rowSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 12 },
  actionBtn: { paddingHorizontal: 4 },
  actionEdit: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New" },
  actionDelete: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New" },
  defaultBadge: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1 },
  confirmText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
  addBtn: {
    marginTop: 12, paddingVertical: 10, borderWidth: 1,
    borderColor: COLORS.amberDim, borderStyle: "dashed", alignItems: "center",
  },
  addBtnText: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.bgElevated, padding: 24, borderTopWidth: 1, borderTopColor: COLORS.border },
  title: {
    fontSize: 11, color: COLORS.amber, letterSpacing: 2,
    textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 20,
  },
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.amber, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, alignItems: "center" },
  btnSecondaryText: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
});
