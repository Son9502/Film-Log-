import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { unzip } from "react-native-zip-archive";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { uploadScan } from "@/services/supabase";

const IMAGE_EXTS = /\.(jpg|jpeg|png|heic|heif|tiff|tif)$/i;

type FileEntry = { name: string; uri: string };
type Assignments = Record<string, number | null>;

export default function ImportScansScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rolls, updateShot, user } = useFilmLogStore();

  const roll = rolls.find((r) => r.id === id);

  const [step, setStep] = useState<"pick" | "preview" | "uploading" | "done">("pick");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [assigningFile, setAssigningFile] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!roll) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Roll not found.</Text>
      </View>
    );
  }

  const sortedShots = [...roll.shots].sort((a, b) => a.frame - b.frame);
  const frameNumbers = sortedShots.map((sh) => sh.frame);

  function autoAssign(imageFiles: FileEntry[]): Assignments {
    const map: Assignments = {};
    imageFiles.forEach((f, i) => {
      map[f.name] = frameNumbers[i] ?? null;
    });
    return map;
  }

  async function pickZip() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const zipUri = result.assets[0].uri;
      const destDir = (FileSystem.cacheDirectory ?? "") + `import_${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      await unzip(zipUri, destDir);

      const all = await FileSystem.readDirectoryAsync(destDir);
      const imageFiles = all
        .filter((name) => IMAGE_EXTS.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
        .map((name) => ({ name, uri: destDir + name }));

      if (imageFiles.length === 0) {
        setError("No image files found in the ZIP.");
        return;
      }

      setFiles(imageFiles);
      setAssignments(autoAssign(imageFiles));
      setStep("preview");
    } catch (e: any) {
      setError(e.message ?? "Failed to read ZIP file.");
    }
  }

  async function pickPhotos() {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsMultipleSelection: true,
        quality: 0.85,
        orderedSelection: true,
      });
      if (result.canceled) return;

      if (result.assets.length === 0) {
        setError("No photos selected.");
        return;
      }

      const imageFiles: FileEntry[] = result.assets.map((asset, i) => ({
        name: asset.fileName ?? `photo_${i + 1}.jpg`,
        uri: asset.uri,
      }));

      setFiles(imageFiles);
      setAssignments(autoAssign(imageFiles));
      setStep("preview");
    } catch (e: any) {
      setError(e.message ?? "Failed to pick photos.");
    }
  }

  async function confirmImport() {
    if (!user) {
      setError("Sign in required to upload scans.");
      return;
    }

    const toUpload = files.filter((f) => assignments[f.name] !== null);
    if (toUpload.length === 0) {
      setError("Assign at least one file to a frame.");
      return;
    }

    setStep("uploading");
    setUploadTotal(toUpload.length);
    setUploadDone(0);
    setUploadFailed(0);

    const r = roll!;
    let done = 0;
    let failed = 0;
    for (const file of toUpload) {
      const frameNum = assignments[file.name];
      const shot = r.shots.find((sh) => sh.frame === frameNum);
      if (!shot) continue;
      try {
        const path = await uploadScan(user.id, r.id, shot.id, file.uri);
        updateShot(r.id, { ...shot, scanUri: path });
        done++;
        setUploadDone(done);
      } catch (e: any) {
        console.error(`Upload failed for frame ${frameNum}:`, e);
        failed++;
        setUploadFailed(failed);
      }
    }

    setStep("done");
  }

  function assignFrame(filename: string, frame: number | null) {
    setAssignments((prev) => {
      const next = { ...prev };
      if (frame !== null) {
        const prevOwner = Object.keys(next).find(
          (k) => k !== filename && next[k] === frame,
        );
        if (prevOwner) next[prevOwner] = null;
      }
      next[filename] = frame;
      return next;
    });
    setAssigningFile(null);
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <View style={s.center}>
        <Text style={s.doneTitle}>{uploadDone > 0 ? "Import Complete" : "Import Failed"}</Text>
        <Text style={s.doneSub}>
          {uploadDone} scan{uploadDone !== 1 ? "s" : ""} uploaded.
          {uploadFailed > 0 && `\n${uploadFailed} failed — check your connection and Supabase storage bucket.`}
        </Text>
        <TouchableOpacity style={s.btnBlock} onPress={() => router.back()}>
          <Text style={s.btnText}>Back to Roll</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Uploading ─────────────────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.amber} size="large" />
        <Text style={s.uploadingText}>{uploadDone} / {uploadTotal} uploaded</Text>
      </View>
    );
  }

  // ── Pick ──────────────────────────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <View style={s.container}>
        <Text style={s.sectionTitle}>Import Scans</Text>
        <Text style={s.instructions}>
          Choose how to import scans for this roll. Files will be sorted alphabetically
          and matched to frames in order — you can reassign them before uploading.
        </Text>
        {error && <Text style={s.error}>{error}</Text>}
        {roll.shots.length === 0 && (
          <Text style={s.warning}>Log at least one frame before importing scans.</Text>
        )}
        <TouchableOpacity
          style={[s.optionBtn, roll.shots.length === 0 && s.btnDisabled]}
          onPress={pickZip}
          disabled={roll.shots.length === 0}
        >
          <Text style={s.optionBtnTitle}>Select ZIP File</Text>
          <Text style={s.optionBtnSub}>Extract and import a ZIP of scan images</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.optionBtn, roll.shots.length === 0 && s.btnDisabled]}
          onPress={pickPhotos}
          disabled={roll.shots.length === 0}
        >
          <Text style={s.optionBtnTitle}>Select Individual Photos</Text>
          <Text style={s.optionBtnSub}>Pick one or more images from your library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview / assignment ──────────────────────────────────────────────────────
  const assignedCount = Object.values(assignments).filter((v) => v !== null).length;
  const unassignedFiles = files.length - assignedCount;
  const framesWithoutScan = frameNumbers.length - assignedCount;

  return (
    <View style={s.container}>
      <FlatList
        data={files}
        keyExtractor={(f) => f.name}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <>
            <Text style={s.sectionTitle}>Assign Scans to Frames</Text>

            {/* Mismatch warning */}
            {files.length !== frameNumbers.length && (
              <View style={s.mismatchBanner}>
                {files.length > frameNumbers.length ? (
                  <Text style={s.mismatchText}>
                    {files.length} photos · {frameNumbers.length} frames —{" "}
                    <Text style={s.mismatchHighlight}>
                      {unassignedFiles} photo{unassignedFiles !== 1 ? "s" : ""} won't be imported
                    </Text>
                    . Tap rows to reassign.
                  </Text>
                ) : (
                  <Text style={s.mismatchText}>
                    {files.length} photos · {frameNumbers.length} frames —{" "}
                    <Text style={s.mismatchHighlight}>
                      {framesWithoutScan} frame{framesWithoutScan !== 1 ? "s" : ""} won't have a scan
                    </Text>
                    . Tap rows to reassign.
                  </Text>
                )}
              </View>
            )}

            <Text style={s.instructions}>
              Tap a row to change its frame assignment. Unassigned photos won't be uploaded.
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const frame = assignments[item.name];
          return (
            <TouchableOpacity style={s.fileRow} onPress={() => setAssigningFile(item.name)}>
              <Image source={{ uri: item.uri }} style={s.fileThumb} resizeMode="cover" />
              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={frame !== null ? s.frameAssigned : s.frameUnassigned}>
                  {frame !== null ? `Frame ${frame}` : "Unassigned — tap to assign"}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={s.footer}>
            {error && <Text style={s.error}>{error}</Text>}
            <View style={s.footerBtns}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setStep("pick")}>
                <Text style={s.btnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={confirmImport}>
                <Text style={s.btnText}>
                  Upload {assignedCount} Scan{assignedCount !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />

      {/* Frame assignment picker */}
      <Modal
        visible={assigningFile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigningFile(null)}
      >
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Assign to Frame</Text>
            <TouchableOpacity
              style={s.pickerOption}
              onPress={() => assigningFile && assignFrame(assigningFile, null)}
            >
              <Text style={s.pickerOptionMuted}>Unassigned</Text>
            </TouchableOpacity>
            {frameNumbers.map((fn) => {
              const isCurrentFile = assigningFile !== null && assignments[assigningFile] === fn;
              const takenBy = Object.keys(assignments).find(
                (k) => k !== assigningFile && assignments[k] === fn,
              );
              return (
                <TouchableOpacity
                  key={fn}
                  style={[s.pickerOption, isCurrentFile && s.pickerOptionActive]}
                  onPress={() => assigningFile && assignFrame(assigningFile, fn)}
                >
                  <Text style={[s.pickerOptionText, isCurrentFile && s.pickerOptionTextActive]}>
                    Frame {fn}
                  </Text>
                  {takenBy && !isCurrentFile && (
                    <Text style={s.pickerOptionSub} numberOfLines={1}>
                      Currently: {takenBy}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setAssigningFile(null)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  listContent: { paddingBottom: 32 },

  sectionTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  instructions: {
    fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New",
    lineHeight: 18, marginBottom: 16,
  },
  warning: { fontSize: 11, color: COLORS.amberLight, fontFamily: "Courier New", marginBottom: 16 },
  error: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", marginBottom: 12, lineHeight: 18 },
  muted: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New" },

  optionBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12, backgroundColor: COLORS.bgCard,
  },
  optionBtnTitle: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New", marginBottom: 4 },
  optionBtnSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New" },

  mismatchBanner: {
    borderWidth: 1, borderColor: COLORS.amberDim,
    backgroundColor: COLORS.bgCard, padding: 12, marginBottom: 12,
  },
  mismatchText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 18 },
  mismatchHighlight: { color: COLORS.amber },

  btn: { flex: 1, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  btnBlock: { backgroundColor: COLORS.amber, paddingVertical: 14, paddingHorizontal: 40, alignItems: "center" },
  btnText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  btnDisabled: { opacity: 0.4 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: "center", marginRight: 12 },
  btnSecondaryText: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },

  fileRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  fileThumb: { width: 52, height: 52, backgroundColor: COLORS.bgCard },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New" },
  frameAssigned: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", marginTop: 3 },
  frameUnassigned: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 3 },
  chevron: { fontSize: 18, color: COLORS.textDim },

  footer: { paddingTop: 20 },
  footerBtns: { flexDirection: "row" },

  doneTitle: { fontSize: 16, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  doneSub: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New", marginBottom: 32 },
  uploadingText: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 16 },

  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: COLORS.bgElevated, borderTopWidth: 1,
    borderTopColor: COLORS.border, paddingTop: 20, paddingBottom: 40, maxHeight: "80%",
  },
  pickerTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 8, paddingHorizontal: 20,
  },
  pickerOption: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  pickerOptionActive: { backgroundColor: COLORS.bgCard },
  pickerOptionText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New" },
  pickerOptionTextActive: { color: COLORS.amber },
  pickerOptionSub: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },
  pickerOptionMuted: { fontSize: 13, color: COLORS.textDim, fontFamily: "Courier New" },
  pickerCancel: { paddingVertical: 16, alignItems: "center" },
  pickerCancelText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
});
