import { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, StyleSheet, Image, ActivityIndicator, Platform, Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { useFilmLogStore } from "@/store";
import { COLORS, LIGHTING_CONDITIONS, FRAME_COUNT_OPTIONS, FILTER_OPTIONS, WEATHER_CONDITIONS, MAX_STARS } from "@/constants";
import { uid, formatDate, rollProgress, statusColors, validateFrameCountChange } from "@/utils";
import { Shot, RollStatus } from "@/types";
import { uploadScan, getScanUrl, deleteScan } from "@/services/supabase";

// ── Scan thumbnail (fetches signed URL on mount) ───────────────────────────────

function ScanThumb({ path, style, resizeMode = "cover" }: { path: string; style?: any; resizeMode?: "cover" | "contain" }) {
  const [url, setUrl] = useState<string | null>(null);
  const retries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    retries.current = 0;
    getScanUrl(path)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  function handleError() {
    if (retries.current >= 2) return;
    retries.current++;
    setUrl(null);
    getScanUrl(path).then((u) => setUrl(u)).catch(() => {});
  }

  if (!url) return <View style={[style, { backgroundColor: COLORS.bgCard }]} />;
  return <Image source={{ uri: url }} style={style} resizeMode={resizeMode} onError={handleError} />;
}

// ── Geocoding helper ─────────────────────────────────────────────────────────
// Converts a text location (e.g. "Seattle, WA") to lat/lng.
// Native: expo-location's built-in geocoder (Apple/Google Maps underneath).
// Web: Nominatim (OpenStreetMap) — free, no API key, CORS-friendly.
async function geocodeLocationText(text: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!text.trim()) return null;
  try {
    if (Platform.OS !== "web") {
      const results = await Location.geocodeAsync(text.trim());
      if (results.length > 0) return { latitude: results[0].latitude, longitude: results[0].longitude };
      return null;
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text.trim())}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } },
    );
    const data = await res.json();
    if (data.length > 0) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    return null;
  } catch {
    return null;
  }
}

// ── Log Frame Modal ───────────────────────────────────────────────────────────

function LogFrameModal({
  visible,
  frameNumber,
  onSave,
  onClose,
}: {
  visible: boolean;
  frameNumber: number;
  onSave: (shot: Shot) => void;
  onClose: () => void;
}) {
  const [shutter, setShutter] = useState("");
  const [aperture, setAperture] = useState("");
  const [lighting, setLighting] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [resolvedLocation, setResolvedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lightingOpen, setLightingOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [flash, setFlash] = useState<boolean | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [weather, setWeather] = useState("");
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      Location.requestForegroundPermissionsAsync().catch(() => {});
      setTimestamp(new Date().toISOString().slice(0, 16).replace("T", " "));
    } else {
      setResolvedLocation(null);
    }
  }, [visible]);

  async function handleResolve() {
    setResolving(true);
    setResolvedLocation(null);
    const result = await geocodeLocationText(locationLabel);
    setResolvedLocation(result);
    setResolving(false);
  }

  async function handleSave() {
    // If the user resolved a location text, use those coords.
    // Otherwise fall back to device GPS (only when no manual label was given).
    let location: Shot["location"] | undefined = resolvedLocation ?? undefined;
    if (!location && !locationLabel.trim()) {
      try {
        setLocating(true);
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch {
      } finally {
        setLocating(false);
      }
    }

    onSave({
      id: uid(),
      frame: frameNumber,
      shutter: shutter.trim() || undefined,
      aperture: aperture.trim() || undefined,
      lighting: lighting || undefined,
      subject: subject.trim() || undefined,
      notes: notes.trim() || undefined,
      locationLabel: locationLabel.trim() || undefined,
      location,
      timestamp: timestamp.trim() || undefined,
      flash,
      filter: filter || undefined,
      weather: weather || undefined,
      rating,
      tags: tags.length > 0 ? tags : undefined,
    });
    setShutter(""); setAperture(""); setLighting("");
    setSubject(""); setNotes(""); setLocationLabel("");
    setTimestamp(""); setFlash(undefined); setFilter(""); setWeather("");
    setRating(undefined); setTagInput(""); setTags([]);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <ScrollView style={m.sheet} keyboardShouldPersistTaps="handled">
          <Text style={m.title}>Frame {frameNumber}</Text>

          <View style={m.row2}>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Shutter</Text>
              <TextInput style={m.input} value={shutter} onChangeText={setShutter}
                placeholder="1/250" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Aperture</Text>
              <TextInput style={m.input} value={aperture} onChangeText={setAperture}
                placeholder="f/2.8" placeholderTextColor={COLORS.textDim} />
            </View>
          </View>

          <Text style={m.label}>Lighting</Text>
          <TouchableOpacity style={m.picker} onPress={() => setLightingOpen(true)}>
            <Text style={lighting ? m.pickerText : m.pickerPlaceholder}>
              {lighting || "Select lighting condition"}
            </Text>
            <Text style={m.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={m.label}>Subject</Text>
          <TextInput style={m.input} value={subject} onChangeText={setSubject}
            placeholder="What are you shooting?" placeholderTextColor={COLORS.textDim} />

          <Text style={m.label}>Notes</Text>
          <TextInput style={[m.input, m.inputMulti]} value={notes} onChangeText={setNotes}
            placeholder="Any extra notes..." placeholderTextColor={COLORS.textDim}
            multiline numberOfLines={2} />

          <Text style={m.label}>Location</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[m.input, { flex: 1 }]} value={locationLabel}
              onChangeText={(t) => { setLocationLabel(t); setResolvedLocation(null); }}
              placeholder="e.g. Tokyo, Japan" placeholderTextColor={COLORS.textDim} />
            <TouchableOpacity
              style={[m.resolveBtn, (!locationLabel.trim() || resolving) && m.btnDisabled]}
              onPress={handleResolve}
              disabled={!locationLabel.trim() || resolving}
            >
              {resolving
                ? <ActivityIndicator color={COLORS.amber} size="small" />
                : <Text style={m.resolveBtnText}>📍</Text>
              }
            </TouchableOpacity>
          </View>
          {resolvedLocation && (
            <Text style={m.resolvedCoords}>
              ✓ {resolvedLocation.latitude.toFixed(4)}°, {resolvedLocation.longitude.toFixed(4)}°
            </Text>
          )}
          {resolvedLocation === null && locationLabel.trim().length > 0 && !resolving && (
            null
          )}

          <Text style={m.label}>Shot At</Text>
          <TextInput style={m.input} value={timestamp} onChangeText={setTimestamp}
            placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={COLORS.textDim} />

          <Text style={m.label}>Flash</Text>
          <View style={m.segmented}>
            <TouchableOpacity style={[m.segment, flash === false && m.segmentActive]}
              onPress={() => setFlash(flash === false ? undefined : false)}>
              <Text style={[m.segmentText, flash === false && m.segmentTextActive]}>Off</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.segment, flash === true && m.segmentActive]}
              onPress={() => setFlash(flash === true ? undefined : true)}>
              <Text style={[m.segmentText, flash === true && m.segmentTextActive]}>On</Text>
            </TouchableOpacity>
          </View>

          <Text style={m.label}>Filter</Text>
          <TouchableOpacity style={m.picker} onPress={() => setFilterOpen(true)}>
            <Text style={filter ? m.pickerText : m.pickerPlaceholder}>
              {filter || "Select filter"}
            </Text>
            <Text style={m.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={m.label}>Weather</Text>
          <TouchableOpacity style={m.picker} onPress={() => setWeatherOpen(true)}>
            <Text style={weather ? m.pickerText : m.pickerPlaceholder}>
              {weather || "Select weather"}
            </Text>
            <Text style={m.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={m.label}>Rating</Text>
          <View style={m.starRow}>
            {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(rating === star ? undefined : star)}>
                <Text style={[m.star, star <= (rating ?? 0) && m.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Tags</Text>
          <View style={m.tagInputRow}>
            <TextInput
              style={[m.input, { flex: 1 }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag, press +"
              placeholderTextColor={COLORS.textDim}
              onSubmitEditing={() => {
                const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                if (t && !tags.includes(t)) setTags([...tags, t]);
                setTagInput("");
              }}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={m.tagAddBtn}
              onPress={() => {
                const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                if (t && !tags.includes(t)) setTags([...tags, t]);
                setTagInput("");
              }}
              disabled={!tagInput.trim()}
            >
              <Text style={m.tagAddText}>+</Text>
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={m.tagChips}>
              {tags.map((t) => (
                <TouchableOpacity key={t} style={m.tagChip} onPress={() => setTags(tags.filter((x) => x !== t))}>
                  <Text style={m.tagChipText}>{t}  ×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={m.actions}>
            <TouchableOpacity style={m.btnSecondary} onPress={onClose}>
              <Text style={m.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.btnPrimary, locating && m.btnDisabled]}
              onPress={handleSave} disabled={locating}>
              {locating
                ? <ActivityIndicator color={COLORS.bg} size="small" />
                : <Text style={m.btnPrimaryText}>Log Frame</Text>
              }
            </TouchableOpacity>
          </View>

          <Modal visible={lightingOpen} transparent animationType="slide"
            onRequestClose={() => setLightingOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Lighting</Text>
                {LIGHTING_CONDITIONS.map((l) => (
                  <TouchableOpacity key={l} style={[m.option, lighting === l && m.optionActive]}
                    onPress={() => { setLighting(l); setLightingOpen(false); }}>
                    <Text style={[m.optionText, lighting === l && m.optionTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setLightingOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Filter</Text>
                {FILTER_OPTIONS.map((f) => (
                  <TouchableOpacity key={f} style={[m.option, filter === f && m.optionActive]}
                    onPress={() => { setFilter(f); setFilterOpen(false); }}>
                    <Text style={[m.optionText, filter === f && m.optionTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
                {filter ? (
                  <TouchableOpacity style={m.option} onPress={() => { setFilter(""); setFilterOpen(false); }}>
                    <Text style={[m.optionText, { color: COLORS.textDim }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setFilterOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={weatherOpen} transparent animationType="slide" onRequestClose={() => setWeatherOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Weather</Text>
                {WEATHER_CONDITIONS.map((w) => (
                  <TouchableOpacity key={w} style={[m.option, weather === w && m.optionActive]}
                    onPress={() => { setWeather(w); setWeatherOpen(false); }}>
                    <Text style={[m.optionText, weather === w && m.optionTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
                {weather ? (
                  <TouchableOpacity style={m.option} onPress={() => { setWeather(""); setWeatherOpen(false); }}>
                    <Text style={[m.optionText, { color: COLORS.textDim }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setWeatherOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Edit Shot Modal ───────────────────────────────────────────────────────────

function EditShotModal({
  visible,
  shot,
  rollId,
  isLastFrame,
  rollStatus,
  onClose,
}: {
  visible: boolean;
  shot: Shot | null;
  rollId: string;
  isLastFrame: boolean;
  rollStatus: RollStatus;
  onClose: () => void;
}) {
  const { updateShot, deleteShot, user } = useFilmLogStore();

  const [shutter, setShutter] = useState(shot?.shutter ?? "");
  const [aperture, setAperture] = useState(shot?.aperture ?? "");
  const [lighting, setLighting] = useState(shot?.lighting ?? "");
  const [subject, setSubject] = useState(shot?.subject ?? "");
  const [notes, setNotes] = useState(shot?.notes ?? "");
  const [locationLabel, setLocationLabel] = useState(shot?.locationLabel ?? "");
  const [lightingOpen, setLightingOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [scanRemoved, setScanRemoved] = useState(false);
  const [scanUploading, setScanUploading] = useState(false);
  const [scanRotation, setScanRotation] = useState<0 | 90 | 180 | 270>(0);
  const [timestamp, setTimestamp] = useState(shot?.timestamp ?? "");
  const [flash, setFlash] = useState<boolean | undefined>(shot?.flash);
  const [filter, setFilter] = useState(shot?.filter ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [weather, setWeather] = useState(shot?.weather ?? "");
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [rating, setRating] = useState<number | undefined>(shot?.rating);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(shot?.tags ?? []);
  const [scanZoomOpen, setScanZoomOpen] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState<{ latitude: number; longitude: number } | null>(shot?.location ?? null);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Escape closes internal scan lightbox before the outer modal
  useEffect(() => {
    if (Platform.OS !== "web" || !scanZoomOpen) return;
    const d = (globalThis as unknown as { document?: Document }).document;
    if (!d) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setScanZoomOpen(false); };
    d.addEventListener("keydown", handler);
    return () => d.removeEventListener("keydown", handler);
  }, [scanZoomOpen]);

  // Reset all form fields when the shot changes (arrow-key navigation reuses this component instance)
  useEffect(() => {
    if (!shot) return;
    setShutter(shot.shutter ?? "");
    setAperture(shot.aperture ?? "");
    setLighting(shot.lighting ?? "");
    setSubject(shot.subject ?? "");
    setNotes(shot.notes ?? "");
    setLocationLabel(shot.locationLabel ?? "");
    setPendingLocalUri(null);
    setScanRemoved(false);
    setScanRotation(0);
    setTimestamp(shot.timestamp ?? "");
    setFlash(shot.flash);
    setFilter(shot.filter ?? "");
    setWeather(shot.weather ?? "");
    setRating(shot.rating);
    setTagInput("");
    setTags(shot.tags ?? []);
    setScanZoomOpen(false);
    setResolvedLocation(shot?.location ?? null);
    setResolving(false);
    setLocating(false);
    setLightingOpen(false);
    setFilterOpen(false);
    setWeatherOpen(false);
    setConfirmingDelete(false);
  }, [shot?.id]);

  if (!shot) return null;

  const hasScan = pendingLocalUri !== null || (!scanRemoved && !!shot.scanUri);

  async function pickScan() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingLocalUri(result.assets[0].uri);
      setScanRemoved(false);
    }
  }

  async function handleResolveLocation() {
    setResolving(true);
    setResolvedLocation(null);
    const result = await geocodeLocationText(locationLabel);
    setResolvedLocation(result);
    setResolving(false);
  }

  async function handleLocate() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setResolvedLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      }
    } catch {}
    setLocating(false);
  }

  async function handleSave() {
    let scanUri: string | undefined = shot!.scanUri;

    if (scanRemoved && shot!.scanUri) {
      try { await deleteScan(shot!.scanUri); } catch {}
      scanUri = undefined;
    }

    if (pendingLocalUri && user) {
      setScanUploading(true);
      try {
        scanUri = await uploadScan(user.id, rollId, shot!.id, pendingLocalUri);
      } catch (e) {
        console.error("Scan upload failed:", e);
      } finally {
        setScanUploading(false);
      }
    }

    updateShot(rollId, {
      ...shot!,
      shutter: shutter.trim() || undefined,
      aperture: aperture.trim() || undefined,
      lighting: lighting || undefined,
      subject: subject.trim() || undefined,
      notes: notes.trim() || undefined,
      locationLabel: locationLabel.trim() || undefined,
      location: resolvedLocation ?? (locationLabel.trim() ? shot?.location : undefined),
      scanUri,
      timestamp: timestamp.trim() || undefined,
      flash,
      filter: filter || undefined,
      weather: weather || undefined,
      rating,
      tags: tags.length > 0 ? tags : undefined,
    });
    onClose();
  }

  const scanAllowed = rollStatus === "Developed" || rollStatus === "At Lab" || rollStatus === "Archived";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <ScrollView style={m.sheet} keyboardShouldPersistTaps="handled">
          <Text style={m.title}>Frame {shot.frame}</Text>

          {/* Scan + fields side by side — horizontally scrollable for large scans */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.cardScroll}>
            <View style={m.cardRow}>
              {scanAllowed && (() => {
                const rotated = scanRotation === 90 || scanRotation === 270;
                const cW = rotated ? 300 : 500;
                const cH = rotated ? 500 : 300;
                const containerStyle = { width: cW, height: cH, overflow: "hidden" as const };
                const imgStyle = {
                  position: "absolute" as const,
                  width: 500, height: 300,
                  top: rotated ? 100 : 0,
                  left: rotated ? -100 : 0,
                  transform: [{ rotate: `${scanRotation}deg` }],
                };
                return (
                  <View>
                    {hasScan ? (
                      <>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setScanZoomOpen(true)}
                          style={{ position: "relative" }}
                        >
                          <View style={containerStyle}>
                            {pendingLocalUri ? (
                              <Image source={{ uri: pendingLocalUri }} style={imgStyle} resizeMode="cover" />
                            ) : (
                              <ScanThumb path={shot.scanUri!} style={imgStyle} />
                            )}
                          </View>
                          <View style={m.scanZoomHint}>
                            <Text style={m.scanZoomHintText}>⊕</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={m.scanRemoveBtn} onPress={() => {
                          setPendingLocalUri(null);
                          setScanRemoved(true);
                        }}>
                          <Text style={m.scanRemoveText}>Remove</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={[containerStyle, m.scanAttachBtn]} onPress={pickScan}>
                        <Text style={m.scanAttachIcon}>+</Text>
                        <Text style={m.scanAttachLabel}>Scan</Text>
                      </TouchableOpacity>
                    )}

                    <View style={m.orientRow}>
                      <TouchableOpacity style={m.orientBtn}
                        onPress={() => setScanRotation(p => (((p - 90) % 360 + 360) % 360) as 0 | 90 | 180 | 270)}>
                        <Text style={m.orientBtnText}>↺  Left</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={m.orientBtn}
                        onPress={() => setScanRotation(p => ((p + 90) % 360) as 0 | 90 | 180 | 270)}>
                        <Text style={m.orientBtnText}>↻  Right</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

              {/* Fields: 2 rows beside the scan */}
              <View style={m.fieldsCol}>
                <View style={m.fieldsRow}>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Shutter</Text>
                    <TextInput style={m.input} value={shutter} onChangeText={setShutter}
                      placeholder="1/250" placeholderTextColor={COLORS.textDim} />
                  </View>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Aperture</Text>
                    <TextInput style={m.input} value={aperture} onChangeText={setAperture}
                      placeholder="f/2.8" placeholderTextColor={COLORS.textDim} />
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Lighting</Text>
                    <TouchableOpacity style={m.picker} onPress={() => setLightingOpen(true)}>
                      <Text style={lighting ? m.pickerText : m.pickerPlaceholder} numberOfLines={1}>
                        {lighting || "—"}
                      </Text>
                      <Text style={m.pickerArrow}>›</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Subject</Text>
                    <TextInput style={m.input} value={subject} onChangeText={setSubject}
                      placeholder="Subject…" placeholderTextColor={COLORS.textDim} />
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Notes</Text>
                    <TextInput style={[m.input, m.inputMulti]} value={notes} onChangeText={setNotes}
                      placeholder="Any extra notes..." placeholderTextColor={COLORS.textDim}
                      multiline numberOfLines={3} />
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Location</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        style={[m.input, { flex: 1 }]}
                        value={locationLabel}
                        onChangeText={(t) => { setLocationLabel(t); setResolvedLocation(null); }}
                        placeholder="e.g. Tokyo, Japan"
                        placeholderTextColor={COLORS.textDim}
                      />
                      <TouchableOpacity
                        style={[m.resolveBtn, (!locationLabel.trim() || resolving) && m.btnDisabled]}
                        onPress={handleResolveLocation}
                        disabled={!locationLabel.trim() || resolving}
                      >
                        {resolving
                          ? <ActivityIndicator color={COLORS.amber} size="small" />
                          : <Text style={m.resolveBtnText}>📍</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[m.resolveBtn, locating && m.btnDisabled]}
                        onPress={handleLocate}
                        disabled={locating}
                      >
                        {locating
                          ? <ActivityIndicator color={COLORS.amber} size="small" />
                          : <Text style={m.resolveBtnText}>◎</Text>}
                      </TouchableOpacity>
                    </View>
                    {resolvedLocation && (
                      <Text style={m.resolvedCoords}>
                        ✓ {resolvedLocation.latitude.toFixed(4)}°, {resolvedLocation.longitude.toFixed(4)}°
                      </Text>
                    )}
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Shot At</Text>
                    <TextInput style={m.input} value={timestamp} onChangeText={setTimestamp}
                      placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={COLORS.textDim} />
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Flash</Text>
                    <View style={m.segmented}>
                      <TouchableOpacity style={[m.segment, flash === false && m.segmentActive]}
                        onPress={() => setFlash(flash === false ? undefined : false)}>
                        <Text style={[m.segmentText, flash === false && m.segmentTextActive]}>Off</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[m.segment, flash === true && m.segmentActive]}
                        onPress={() => setFlash(flash === true ? undefined : true)}>
                        <Text style={[m.segmentText, flash === true && m.segmentTextActive]}>On</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Filter</Text>
                    <TouchableOpacity style={m.picker} onPress={() => setFilterOpen(true)}>
                      <Text style={filter ? m.pickerText : m.pickerPlaceholder} numberOfLines={1}>
                        {filter || "—"}
                      </Text>
                      <Text style={m.pickerArrow}>›</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={m.fieldCell}>
                    <Text style={m.label}>Weather</Text>
                    <TouchableOpacity style={m.picker} onPress={() => setWeatherOpen(true)}>
                      <Text style={weather ? m.pickerText : m.pickerPlaceholder} numberOfLines={1}>
                        {weather || "—"}
                      </Text>
                      <Text style={m.pickerArrow}>›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Rating</Text>
                    <View style={m.starRow}>
                      {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(rating === star ? undefined : star)}>
                          <Text style={[m.star, star <= (rating ?? 0) && m.starFilled]}>★</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={m.fieldsRow}>
                  <View style={m.notesCell}>
                    <Text style={m.label}>Tags</Text>
                    <View style={m.tagInputRow}>
                      <TextInput
                        style={[m.input, { flex: 1 }]}
                        value={tagInput}
                        onChangeText={setTagInput}
                        placeholder="Add tag, press +"
                        placeholderTextColor={COLORS.textDim}
                        onSubmitEditing={() => {
                          const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                          if (t && !tags.includes(t)) setTags([...tags, t]);
                          setTagInput("");
                        }}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={m.tagAddBtn}
                        onPress={() => {
                          const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
                          if (t && !tags.includes(t)) setTags([...tags, t]);
                          setTagInput("");
                        }}
                        disabled={!tagInput.trim()}
                      >
                        <Text style={m.tagAddText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {tags.length > 0 && (
                      <View style={m.tagChips}>
                        {tags.map((t) => (
                          <TouchableOpacity key={t} style={m.tagChip} onPress={() => setTags(tags.filter((x) => x !== t))}>
                            <Text style={m.tagChipText}>{t}  ×</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={m.actions}>
            <TouchableOpacity style={m.btnSecondary} onPress={onClose} disabled={scanUploading}>
              <Text style={m.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.btnPrimary, scanUploading && m.btnDisabled]}
              onPress={handleSave} disabled={scanUploading}>
              {scanUploading
                ? <ActivityIndicator color={COLORS.bg} size="small" />
                : <Text style={m.btnPrimaryText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Delete — only available on the last logged frame */}
          {isLastFrame && (
            <View style={m.deleteRow}>
              {confirmingDelete ? (
                <>
                  <Text style={m.deleteConfirmText}>Delete this frame?</Text>
                  <TouchableOpacity onPress={() => { deleteShot(rollId, shot!.id); onClose(); }}>
                    <Text style={m.deleteBtnYes}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmingDelete(false)}>
                    <Text style={m.deleteBtnNo}>No</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={m.deleteBtnRect} onPress={() => setConfirmingDelete(true)}>
                  <Text style={m.deleteBtnRectText}>Delete Frame</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Lighting picker */}
          <Modal visible={lightingOpen} transparent animationType="slide"
            onRequestClose={() => setLightingOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Lighting</Text>
                {LIGHTING_CONDITIONS.map((l) => (
                  <TouchableOpacity key={l} style={[m.option, lighting === l && m.optionActive]}
                    onPress={() => { setLighting(l); setLightingOpen(false); }}>
                    <Text style={[m.optionText, lighting === l && m.optionTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setLightingOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Filter</Text>
                {FILTER_OPTIONS.map((f) => (
                  <TouchableOpacity key={f} style={[m.option, filter === f && m.optionActive]}
                    onPress={() => { setFilter(f); setFilterOpen(false); }}>
                    <Text style={[m.optionText, filter === f && m.optionTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
                {filter ? (
                  <TouchableOpacity style={m.option} onPress={() => { setFilter(""); setFilterOpen(false); }}>
                    <Text style={[m.optionText, { color: COLORS.textDim }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setFilterOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={weatherOpen} transparent animationType="slide" onRequestClose={() => setWeatherOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Weather</Text>
                {WEATHER_CONDITIONS.map((w) => (
                  <TouchableOpacity key={w} style={[m.option, weather === w && m.optionActive]}
                    onPress={() => { setWeather(w); setWeatherOpen(false); }}>
                    <Text style={[m.optionText, weather === w && m.optionTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
                {weather ? (
                  <TouchableOpacity style={m.option} onPress={() => { setWeather(""); setWeatherOpen(false); }}>
                    <Text style={[m.optionText, { color: COLORS.textDim }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setWeatherOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {/* Internal scan lightbox — absolute overlay inside the modal */}
        {scanZoomOpen && (
          <TouchableOpacity
            style={m.scanLbOverlay}
            activeOpacity={1}
            onPress={() => setScanZoomOpen(false)}
          >
            <TouchableOpacity
              style={m.scanLbClose}
              onPress={() => setScanZoomOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={m.scanLbCloseText}>✕</Text>
            </TouchableOpacity>
            <View style={m.scanLbImageWrap} pointerEvents="none">
              {pendingLocalUri ? (
                <Image
                  source={{ uri: pendingLocalUri }}
                  style={[m.scanLbImage, { transform: [{ rotate: `${scanRotation}deg` }] }]}
                  resizeMode="contain"
                />
              ) : shot.scanUri ? (
                <ScanThumb
                  path={shot.scanUri}
                  style={[m.scanLbImage, { transform: [{ rotate: `${scanRotation}deg` }] }]}
                  resizeMode="contain"
                />
              ) : null}
            </View>
            {Platform.OS === "web" && (
              <Text style={m.scanLbHint}>tap or esc to close</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Edit Roll Modal ───────────────────────────────────────────────────────────

function EditRollModal({
  visible,
  rollId,
  onClose,
}: {
  visible: boolean;
  rollId: string;
  onClose: () => void;
}) {
  const { rolls, cameras, filmStocks, updateRoll } = useFilmLogStore();
  const roll = rolls.find((r) => r.id === rollId);

  const [name, setName] = useState(roll?.name ?? "");
  const [notes, setNotes] = useState(roll?.notes ?? "");
  const [locationLabel, setLocationLabel] = useState(roll?.locationLabel ?? "");
  const [cameraId, setCameraId] = useState(roll?.cameraId ?? "");
  const [filmStockId, setFilmStockId] = useState(roll?.filmStockId ?? "");
  const isPreset = FRAME_COUNT_OPTIONS.includes(roll?.frameCount ?? 36);
  const [frameCount, setFrameCount] = useState(isPreset ? (roll?.frameCount ?? 36) : 36);
  const [useCustomFrames, setUseCustomFrames] = useState(!isPreset);
  const [customFrameInput, setCustomFrameInput] = useState(!isPreset ? (roll?.frameCount?.toString() ?? "") : "");
  const [frameError, setFrameError] = useState<string | null>(null);
  const [rollIsPublic, setRollIsPublic] = useState(roll?.isPublic ?? false);

  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  const [filmPickerOpen, setFilmPickerOpen] = useState(false);
  const [developer, setDeveloper] = useState(roll?.developer ?? "");
  const [dilution, setDilution] = useState(roll?.dilution ?? "");
  const [devTime, setDevTime] = useState(roll?.devTime ?? "");
  const [devTemp, setDevTemp] = useState(roll?.devTemp ?? "");
  const [pushPull, setPushPull] = useState(roll?.pushPull ?? "");
  const [fixer, setFixer] = useState(roll?.fixer ?? "");
  const [photoFlo, setPhotoFlo] = useState<boolean | undefined>(roll?.photoFlo);
  const [resolvedLocation, setResolvedLocation] = useState<{ latitude: number; longitude: number } | null>(roll?.location ?? null);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  if (!roll) return null;

  async function handleResolveLocation() {
    setResolving(true);
    setResolvedLocation(null);
    const result = await geocodeLocationText(locationLabel);
    setResolvedLocation(result);
    setResolving(false);
  }

  async function handleLocate() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setResolvedLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      }
    } catch {}
    setLocating(false);
  }

  const resolvedFrameCount = useCustomFrames ? (parseInt(customFrameInput) || 0) : frameCount;

  function handleFrameCount(n: number) {
    const err = validateFrameCountChange(roll!.shots.length, n);
    setFrameError(err);
    setFrameCount(n);
    setUseCustomFrames(false);
  }

  function handleCustomFrameInput(val: string) {
    setCustomFrameInput(val);
    const n = parseInt(val) || 0;
    const err = validateFrameCountChange(roll!.shots.length, n);
    setFrameError(n > 0 ? err : "Enter a valid frame count.");
  }

  function handleSave() {
    if (frameError) return;
    if (useCustomFrames && resolvedFrameCount <= 0) return;
    const selectedFilm = filmStocks.find((f) => f.id === filmStockId);
    const base = roll!;
    updateRoll({
      ...base,
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
      locationLabel: locationLabel.trim() || undefined,
      location: resolvedLocation ?? (locationLabel.trim() ? roll?.location : undefined),
      cameraId,
      filmStockId,
      iso: selectedFilm?.iso.toString() ?? base.iso,
      frameCount: resolvedFrameCount,
      developer: developer.trim() || undefined,
      dilution: dilution.trim() || undefined,
      devTime: devTime.trim() || undefined,
      devTemp: devTemp.trim() || undefined,
      pushPull: pushPull.trim() || undefined,
      fixer: fixer.trim() || undefined,
      photoFlo,
      isPublic: rollIsPublic,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  }

  const selectedCamera = cameras.find((c) => c.id === cameraId);
  const selectedFilm = filmStocks.find((f) => f.id === filmStockId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <ScrollView style={m.sheet} keyboardShouldPersistTaps="handled">
          <Text style={m.title}>Edit Roll</Text>

          <Text style={m.label}>Roll Name</Text>
          <TextInput style={m.input} value={name} onChangeText={setName}
            placeholder="e.g. Yosemite Trip" placeholderTextColor={COLORS.textDim} />

          <Text style={m.label}>Camera</Text>
          <TouchableOpacity style={m.picker} onPress={() => setCameraPickerOpen(true)}>
            <Text style={m.pickerText}>{selectedCamera?.name ?? "Select"}</Text>
            <Text style={m.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={m.label}>Film Stock</Text>
          <TouchableOpacity style={m.picker} onPress={() => setFilmPickerOpen(true)}>
            <Text style={m.pickerText}>{selectedFilm?.name ?? "Select"}</Text>
            <Text style={m.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={m.label}>Frame Count</Text>
          <View style={m.segmented}>
            {FRAME_COUNT_OPTIONS.map((n) => (
              <TouchableOpacity key={n} style={[m.segment, !useCustomFrames && frameCount === n && m.segmentActive]}
                onPress={() => handleFrameCount(n)}>
                <Text style={[m.segmentText, !useCustomFrames && frameCount === n && m.segmentTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[m.segment, useCustomFrames && m.segmentActive]}
              onPress={() => { setUseCustomFrames(true); setFrameError(null); }}>
              <Text style={[m.segmentText, useCustomFrames && m.segmentTextActive]}>Other</Text>
            </TouchableOpacity>
          </View>
          {useCustomFrames && (
            <TextInput
              style={[m.input, { marginTop: 8 }]}
              value={customFrameInput}
              onChangeText={handleCustomFrameInput}
              placeholder="e.g. 27"
              placeholderTextColor={COLORS.textDim}
              keyboardType="number-pad"
              autoFocus
            />
          )}
          {frameError && <Text style={m.errorText}>{frameError}</Text>}

          <Text style={m.label}>Notes</Text>
          <TextInput style={[m.input, m.inputMulti]} value={notes} onChangeText={setNotes}
            placeholder="Any notes..." placeholderTextColor={COLORS.textDim} multiline numberOfLines={3} />

          <Text style={m.label}>Location</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[m.input, { flex: 1 }]}
              value={locationLabel}
              onChangeText={(t) => { setLocationLabel(t); setResolvedLocation(null); }}
              placeholder="e.g. Yosemite, CA"
              placeholderTextColor={COLORS.textDim}
            />
            <TouchableOpacity
              style={[m.resolveBtn, (!locationLabel.trim() || resolving) && m.btnDisabled]}
              onPress={handleResolveLocation}
              disabled={!locationLabel.trim() || resolving}
            >
              {resolving
                ? <ActivityIndicator color={COLORS.amber} size="small" />
                : <Text style={m.resolveBtnText}>📍</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.resolveBtn, locating && m.btnDisabled]}
              onPress={handleLocate}
              disabled={locating}
            >
              {locating
                ? <ActivityIndicator color={COLORS.amber} size="small" />
                : <Text style={m.resolveBtnText}>◎</Text>}
            </TouchableOpacity>
          </View>
          {resolvedLocation && (
            <Text style={m.resolvedCoords}>
              ✓ {resolvedLocation.latitude.toFixed(4)}°, {resolvedLocation.longitude.toFixed(4)}°
            </Text>
          )}

          <Text style={m.label}>Visibility</Text>
          <View style={m.toggleRow}>
            <View>
              <Text style={m.toggleLabel}>Public roll</Text>
              <Text style={m.toggleSub}>Visible on your public profile</Text>
            </View>
            <Switch
              value={rollIsPublic}
              onValueChange={setRollIsPublic}
              trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
              thumbColor={rollIsPublic ? COLORS.amber : COLORS.textDim}
            />
          </View>

          <Text style={m.label}>Developer</Text>
          <TextInput style={m.input} value={developer} onChangeText={setDeveloper}
            placeholder="e.g. Kodak D-76" placeholderTextColor={COLORS.textDim} />

          <View style={m.row2}>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Dilution</Text>
              <TextInput style={m.input} value={dilution} onChangeText={setDilution}
                placeholder="e.g. 1+1" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Dev Temp</Text>
              <TextInput style={m.input} value={devTemp} onChangeText={setDevTemp}
                placeholder="e.g. 20°C" placeholderTextColor={COLORS.textDim} />
            </View>
          </View>

          <Text style={m.label}>Dev Time</Text>
          <TextInput style={m.input} value={devTime} onChangeText={setDevTime}
            placeholder="e.g. 8:30" placeholderTextColor={COLORS.textDim} />

          <View style={m.row2}>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Push / Pull</Text>
              <TextInput style={m.input} value={pushPull} onChangeText={setPushPull}
                placeholder="e.g. +2, -1" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Fixer</Text>
              <TextInput style={m.input} value={fixer} onChangeText={setFixer}
                placeholder="e.g. Rapid Fixer" placeholderTextColor={COLORS.textDim} />
            </View>
          </View>

          <Text style={m.label}>Photo-Flo / Wetting Agent</Text>
          <View style={m.segmented}>
            <TouchableOpacity style={[m.segment, photoFlo === false && m.segmentActive]}
              onPress={() => setPhotoFlo(photoFlo === false ? undefined : false)}>
              <Text style={[m.segmentText, photoFlo === false && m.segmentTextActive]}>Not Used</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.segment, photoFlo === true && m.segmentActive]}
              onPress={() => setPhotoFlo(photoFlo === true ? undefined : true)}>
              <Text style={[m.segmentText, photoFlo === true && m.segmentTextActive]}>Used</Text>
            </TouchableOpacity>
          </View>

          <View style={m.actions}>
            <TouchableOpacity style={m.btnSecondary} onPress={onClose}>
              <Text style={m.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.btnPrimary, !!frameError && m.btnDisabled]} onPress={handleSave}>
              <Text style={m.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={cameraPickerOpen} transparent animationType="slide"
            onRequestClose={() => setCameraPickerOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Camera</Text>
                {cameras.map((c) => (
                  <TouchableOpacity key={c.id} style={[m.option, cameraId === c.id && m.optionActive]}
                    onPress={() => { setCameraId(c.id); setCameraPickerOpen(false); }}>
                    <Text style={[m.optionText, cameraId === c.id && m.optionTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setCameraPickerOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={filmPickerOpen} transparent animationType="slide"
            onRequestClose={() => setFilmPickerOpen(false)}>
            <View style={m.overlay}>
              <View style={m.innerSheet}>
                <Text style={m.title}>Film Stock</Text>
                {filmStocks.map((f) => (
                  <TouchableOpacity key={f.id} style={[m.option, filmStockId === f.id && m.optionActive]}
                    onPress={() => { setFilmStockId(f.id); setFilmPickerOpen(false); }}>
                    <Text style={[m.optionText, filmStockId === f.id && m.optionTextActive]}>{f.name}</Text>
                    <Text style={m.optionSub}>ISO {f.iso}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={m.cancelBtn} onPress={() => setFilmPickerOpen(false)}>
                  <Text style={m.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const STATUS_ORDER: RollStatus[] = ["Stock", "Shooting", "At Lab", "Developed", "Archived"];

// ── Film strip helpers ────────────────────────────────────────────────────────

// ── Film Strip Modal ──────────────────────────────────────────────────────────

function FilmStripModal({
  visible,
  roll,
  filmStockName,
  onClose,
  onFramePress,
}: {
  visible: boolean;
  roll: { id: string; name?: string; filmStockId: string; frameCount: number; shots: import("@/types").Shot[] };
  filmStockName: string;
  onClose: () => void;
  onFramePress: (shotId: string) => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [zoomedShotId, setZoomedShotId] = useState<string | null>(null);

  // Full frame array: logged shots + empty slots for unlogged frames
  const allFrames = Array.from({ length: roll.frameCount }, (_, i) => {
    const frameNum = i + 1;
    const shot = roll.shots.find((s) => s.frame === frameNum);
    return { frame: frameNum, id: shot?.id ?? null, scanUri: shot?.scanUri };
  });

  const scannedFrames = allFrames.filter((f) => f.scanUri && f.id) as { frame: number; id: string; scanUri: string }[];
  const zoomedFrame = zoomedShotId ? scannedFrames.find((f) => f.id === zoomedShotId) ?? null : null;
  const zoomedLbIdx = zoomedShotId ? scannedFrames.findIndex((f) => f.id === zoomedShotId) : -1;

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) { setFocusedIdx(-1); setZoomedShotId(null); }
  }, [visible]);

  // Keyboard navigation for web
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const d = (globalThis as unknown as { document?: Document }).document;
    if (!d) return;
    const handler = (e: KeyboardEvent) => {
      if (zoomedShotId) {
        // Lightbox open: navigate scanned frames or close
        if (e.key === "ArrowRight" && zoomedLbIdx < scannedFrames.length - 1)
          setZoomedShotId(scannedFrames[zoomedLbIdx + 1].id);
        else if (e.key === "ArrowLeft" && zoomedLbIdx > 0)
          setZoomedShotId(scannedFrames[zoomedLbIdx - 1].id);
        else if (e.key === "Escape") setZoomedShotId(null);
      } else {
        // Strip cursor navigation
        if (e.key === "ArrowRight") setFocusedIdx((i) => Math.min(i < 0 ? 0 : i + 1, allFrames.length - 1));
        else if (e.key === "ArrowLeft") setFocusedIdx((i) => Math.max(i < 0 ? 0 : i - 1, 0));
        else if ((e.key === "Enter" || e.key === " ") && focusedIdx >= 0) {
          const f = allFrames[focusedIdx];
          if (f?.id) {
            if (f.scanUri) setZoomedShotId(f.id);
            else onFramePress(f.id);
          }
        } else if (e.key === "Escape") onClose();
      }
    };
    d.addEventListener("keydown", handler);
    return () => d.removeEventListener("keydown", handler);
  }, [visible, focusedIdx, zoomedShotId, zoomedLbIdx]);

  // Flat row of holes across the full strip — equal HOLE_GAP between every hole.
  // flip=true swaps inner/outer padding so the row facing the photo has the small gap.
  function SprocketRow({ flip = false }: { flip?: boolean }) {
    return (
      <View style={[
        fs.sprocketRow,
        {
          paddingTop:    flip ? SPROCKET_INNER : SPROCKET_OUTER,
          paddingBottom: flip ? SPROCKET_OUTER : SPROCKET_INNER,
          paddingHorizontal: HOLE_GAP / 2,
        },
      ]}>
        <View style={{ flexDirection: "row", gap: HOLE_GAP }}>
          {Array.from({ length: allFrames.length * 8 }).map((_, i) => (
            <View key={i} style={fs.sprocketHole} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fs.overlay}>
        <View style={fs.sheet}>
          {/* Header */}
          <View style={fs.header}>
            <View>
              <Text style={fs.headerTitle}>{roll.name ?? filmStockName}</Text>
              <Text style={fs.headerSub}>{filmStockName} · {roll.frameCount} exp</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={fs.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* The strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={fs.stripScroll}
            contentContainerStyle={fs.stripContent}>
            <View>
              {/* Film strip body */}
              <View style={fs.stripBody}>
                {/* Top sprockets */}
                <SprocketRow />
                {/* Frames */}
                <View style={fs.framesRow}>
                  {allFrames.map((f, idx) => (
                    <TouchableOpacity
                      key={f.frame}
                      style={[fs.frameCell, focusedIdx === idx && fs.frameCellFocused]}
                      activeOpacity={f.id ? 0.75 : 1}
                      onPress={() => {
                        if (!f.id) return;
                        if (f.scanUri) setZoomedShotId(f.id);
                        else onFramePress(f.id);
                      }}
                    >
                      {f.scanUri ? (
                        <ScanThumb path={f.scanUri} style={fs.framePhoto} />
                      ) : (
                        <View style={fs.frameEmpty} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Bottom sprockets */}
                <SprocketRow flip />
              </View>

              {/* Frame numbers — scroll in sync below the strip */}
              <View style={fs.numbersRow}>
                {allFrames.map((f) => (
                  <View key={f.frame} style={fs.numberCell}>
                    <Text style={[fs.numberText, { color: "#d4c8b8" }]}>
                      {String(f.frame).padStart(2, "0")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={fs.closeFullBtn} onPress={onClose}>
            <Text style={fs.closeFullBtnText}>Close</Text>
          </TouchableOpacity>
          {Platform.OS === "web" && (
            <Text style={fs.keyHint}>← →  browse  ·  enter / tap  open  ·  esc  close</Text>
          )}
        </View>

        {/* Internal scan lightbox — covers full overlay */}
        {zoomedShotId && (
          <TouchableOpacity
            style={fs.lbOverlay}
            activeOpacity={1}
            onPress={() => setZoomedShotId(null)}
          >
            <TouchableOpacity
              style={fs.lbClose}
              onPress={() => setZoomedShotId(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={fs.lbCloseText}>✕</Text>
            </TouchableOpacity>
            {scannedFrames.length > 1 && (
              <Text style={fs.lbCounter}>{zoomedLbIdx + 1} / {scannedFrames.length}</Text>
            )}
            <View style={fs.lbImageWrap} pointerEvents="none">
              {zoomedFrame && (
                <ScanThumb path={zoomedFrame.scanUri} style={fs.lbImage} resizeMode="contain" />
              )}
            </View>
            <Text style={fs.lbFrameLabel}>Frame {String(zoomedFrame?.frame ?? 0).padStart(2, "0")}</Text>
            {Platform.OS === "web" && scannedFrames.length > 1 && (
              <Text style={fs.lbHint}>← →  navigate  ·  tap or esc  close</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Roll Map Modal ────────────────────────────────────────────────────────────

function RollMapModal({
  visible,
  shots,
  onClose,
  onMarkerPress,
}: {
  visible: boolean;
  shots: Shot[];
  onClose: () => void;
  onMarkerPress: (shotId: string) => void;
}) {
  const geoShots = shots.filter((s) => s.location);

  // Centre the map on the average of all tagged locations
  const region = (() => {
    if (!geoShots.length) return null;
    const lats = geoShots.map((s) => s.location!.latitude);
    const lngs = geoShots.map((s) => s.location!.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 0.005;
    return {
      latitude:  (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta:  Math.max(maxLat - minLat, pad) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, pad) * 1.4,
    };
  })();

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={mp.container}>
        <View style={mp.header}>
          <Text style={mp.title}>Shot Locations</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={mp.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {!geoShots.length ? (
          <View style={mp.empty}>
            <Text style={mp.emptyText}>No GPS data yet.{"\n"}Log frames while location is enabled to tag shots.</Text>
          </View>
        ) : Platform.OS === "web" ? (
          // Web: react-native-maps is stubbed — show a coordinate list instead
          <ScrollView style={mp.list}>
            {geoShots.map((s) => (
              <TouchableOpacity key={s.id} style={mp.listRow} onPress={() => { onClose(); onMarkerPress(s.id); }}>
                <Text style={mp.listFrame}>Frame {String(s.frame).padStart(2, "0")}</Text>
                <Text style={mp.listCoord}>{s.location!.latitude.toFixed(5)}, {s.location!.longitude.toFixed(5)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          region && (
            <MapView style={mp.map} initialRegion={region}>
              {geoShots.map((s) => (
                <Marker
                  key={s.id}
                  coordinate={{ latitude: s.location!.latitude, longitude: s.location!.longitude }}
                  onPress={() => { onClose(); onMarkerPress(s.id); }}
                >
                  <View style={mp.markerBubble}>
                    <Text style={mp.markerText}>{String(s.frame).padStart(2, "0")}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          )
        )}
      </View>
    </Modal>
  );
}

export default function RollDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rolls, cameras, filmStocks, updateRoll, deleteRoll, addShot } = useFilmLogStore();

  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [filmStripOpen, setFilmStripOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [quickLogging, setQuickLogging] = useState(false);
  const [lightboxShotId, setLightboxShotId] = useState<string | null>(null);

  const roll = rolls.find((r) => r.id === id);

  if (!roll) {
    return (
      <View style={s.center}>
        <Text style={s.notFound}>Roll not found.</Text>
      </View>
    );
  }

  const camera = cameras.find((c) => c.id === roll.cameraId);
  const film = filmStocks.find((f) => f.id === roll.filmStockId);
  const { bg, fg } = statusColors(roll.status);
  const progress = rollProgress(roll.shots.length, roll.frameCount);

  const scannedShots = roll.shots.filter((s) => s.scanUri);
  const lbShot = lightboxShotId ? roll.shots.find((s) => s.id === lightboxShotId) ?? null : null;
  const lbIdx = lightboxShotId ? scannedShots.findIndex((s) => s.id === lightboxShotId) : -1;

  useEffect(() => {
    if (Platform.OS !== "web" || !lightboxShotId) return;
    const d = (globalThis as unknown as { document?: Document }).document;
    if (!d) return;
    const handler = (e: KeyboardEvent) => {
      const idx = scannedShots.findIndex((s) => s.id === lightboxShotId);
      if (e.key === "ArrowRight" && idx < scannedShots.length - 1) setLightboxShotId(scannedShots[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) setLightboxShotId(scannedShots[idx - 1].id);
      if (e.key === "Escape") setLightboxShotId(null);
    };
    d.addEventListener("keydown", handler);
    return () => d.removeEventListener("keydown", handler);
  }, [lightboxShotId, scannedShots]);

  // Arrow key navigation between frames when EditShotModal is open (web only)
  useEffect(() => {
    if (Platform.OS !== "web" || !editingShotId || !!lightboxShotId) return;
    const d = (globalThis as unknown as { document?: Document }).document;
    if (!d) return;
    const handler = (e: KeyboardEvent) => {
      const tag = ((d as Document).activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const sorted = [...roll.shots].sort((a, b) => a.frame - b.frame);
      const idx = sorted.findIndex((s) => s.id === editingShotId);
      if (e.key === "ArrowRight" && idx < sorted.length - 1) setEditingShotId(sorted[idx + 1].id);
      else if (e.key === "ArrowLeft" && idx > 0) setEditingShotId(sorted[idx - 1].id);
    };
    d.addEventListener("keydown", handler);
    return () => d.removeEventListener("keydown", handler);
  }, [editingShotId, lightboxShotId, roll.shots]);

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(roll.status) + 1] as RollStatus | undefined;

  async function handleQuickLog() {
    setQuickLogging(true);
    let location: Shot["location"] | undefined;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    } catch {}
    addShot(roll!.id, { id: uid(), frame: roll!.shots.length + 1, location });
    setQuickLogging(false);
  }

  function advanceStatus() {
    if (!nextStatus) return;
    updateRoll({ ...roll!, status: nextStatus, updatedAt: new Date().toISOString() });
  }

  function confirmDelete() {
    const rollId = roll!.id;
    deleteRoll(rollId);
    router.back();
  }

  const renderShot = ({ item }: { item: Shot }) => (
    <TouchableOpacity style={s.shotRow} onPress={() => setEditingShotId(item.id)} activeOpacity={0.6}>
      {/* Left: scan thumbnail (taps open lightbox) or frame-number placeholder */}
      {item.scanUri ? (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); setLightboxShotId(item.id); }}
          activeOpacity={0.8}
        >
          <ScanThumb path={item.scanUri} style={s.shotThumb} />
          <View style={s.shotThumbZoomHint}>
            <Text style={s.shotThumbZoomIcon}>⊕</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={s.shotThumbEmpty}>
          <Text style={s.shotThumbNum}>{String(item.frame).padStart(2, "0")}</Text>
        </View>
      )}

      {/* Right: metadata fields */}
      <View style={s.shotFields}>
        <View style={s.shotFieldsTop}>
          {item.scanUri && (
            <Text style={s.shotFrameTag}>{String(item.frame).padStart(2, "0")}</Text>
          )}
          {(item.shutter || item.aperture) && (
            <Text style={s.shotExposure}>
              {[item.shutter, item.aperture].filter(Boolean).join("   ·   ")}
            </Text>
          )}
        </View>
        {item.lighting && <Text style={s.shotLighting}>{item.lighting}</Text>}
        {item.subject && <Text style={s.shotSubject}>{item.subject}</Text>}
        {item.notes && <Text style={s.shotNotes}>{item.notes}</Text>}
        {(item.locationLabel || item.location) && (
          <Text style={s.shotPin}>
            📍 {item.locationLabel || `${item.location!.latitude.toFixed(4)}, ${item.location!.longitude.toFixed(4)}`}
          </Text>
        )}
        {(item.flash !== undefined || item.filter || item.weather || item.timestamp) && (
          <Text style={s.shotMeta}>
            {[
              item.flash === true ? "Flash On" : item.flash === false ? "Flash Off" : null,
              item.filter,
              item.weather,
              item.timestamp,
            ].filter(Boolean).join("  ·  ")}
          </Text>
        )}
        {!!item.rating && (
          <Text style={s.shotStars}>
            {"★".repeat(item.rating)}{"☆".repeat(MAX_STARS - item.rating)}
          </Text>
        )}
        {item.tags && item.tags.length > 0 && (
          <Text style={s.shotTags}>{item.tags.map((t) => `#${t}`).join("  ")}</Text>
        )}
      </View>

      <Text style={s.shotEditHint}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <FlatList
        data={roll.shots}
        keyExtractor={(sh) => sh.id}
        renderItem={renderShot}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {/* Roll card */}
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.cardLeft}>
                  {roll.name && <Text style={s.rollName}>{roll.name}</Text>}
                  <Text style={s.filmName}>{film?.name ?? roll.filmStockId}</Text>
                  <Text style={s.meta}>{camera?.name ?? roll.cameraId} · ISO {roll.iso}</Text>
                  <Text style={s.meta}>Loaded {formatDate(roll.loadedAt)}</Text>
                  {roll.locationLabel && <Text style={s.rollLocation}>📍 {roll.locationLabel}</Text>}
                  {(roll.developer || roll.devTime || roll.pushPull) && (
                    <Text style={s.meta}>
                      {[
                        roll.pushPull && `Push/Pull ${roll.pushPull}`,
                        roll.developer,
                        roll.dilution,
                        roll.devTime && `${roll.devTime}${roll.devTemp ? " @ " + roll.devTemp : ""}`,
                        roll.fixer,
                        roll.photoFlo === true ? "Photo-Flo" : null,
                      ].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                </View>
                <View style={s.cardRight}>
                  <Text style={s.shotCount}>{roll.shots.length}</Text>
                  <Text style={s.shotCountLabel}>/ {roll.frameCount}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
              </View>

              {/* Status badge + advance + visibility */}
              <View style={s.statusRow}>
                <View style={[s.badge, { backgroundColor: bg, borderColor: fg }]}>
                  <Text style={[s.badgeText, { color: fg }]}>{roll.status}</Text>
                </View>
                {nextStatus && (
                  <TouchableOpacity style={s.advanceBtn} onPress={advanceStatus}>
                    <Text style={s.advanceText}>→ {nextStatus}</Text>
                  </TouchableOpacity>
                )}
                <View style={[s.badge, { backgroundColor: COLORS.bgCard, borderColor: COLORS.border, marginLeft: "auto" }]}>
                  <Text style={[s.badgeText, { color: roll.isPublic ? COLORS.amber : COLORS.textDim }]}>
                    {roll.isPublic ? "🔓 Public" : "🔒 Private"}
                  </Text>
                </View>
              </View>

              {/* Edit / Delete */}
              <View style={s.actionRow}>
                {confirmingDelete ? (
                  <>
                    <Text style={s.confirmText}>Delete this roll?</Text>
                    <TouchableOpacity style={s.actionBtn} onPress={confirmDelete}>
                      <Text style={s.actionDelete}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => setConfirmingDelete(false)}>
                      <Text style={s.actionEdit}>No</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={s.actionBtn} onPress={() => setEditOpen(true)}>
                      <Text style={s.actionEdit}>Edit Roll</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => setConfirmingDelete(true)}>
                      <Text style={s.actionDelete}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Import Scans — only for developed rolls that have shots */}
            {roll.status === "Developed" && roll.shots.length > 0 && (
              <TouchableOpacity
                style={s.importBtn}
                onPress={() => router.push(`/roll/import?id=${roll.id}`)}
              >
                <Text style={s.importBtnText}>Import Scans</Text>
              </TouchableOpacity>
            )}

            {/* Film Strip / Map — available whenever there are logged shots */}
            {roll.shots.length > 0 && (
              <View style={s.rollActions}>
                <TouchableOpacity style={s.rollActionBtn} onPress={() => setFilmStripOpen(true)}>
                  <Text style={s.rollActionText}>Film Strip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rollActionBtn} onPress={() => setMapOpen(true)}>
                  <Text style={s.rollActionText}>Shot Map</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Shots header */}
            <Text style={s.sectionTitle}>Frames</Text>
            {roll.shots.length === 0 && (
              <Text style={s.emptyShots}>
                {roll.status === "Shooting"
                  ? "No frames logged yet. Tap + to log your first shot."
                  : "No frames logged."}
              </Text>
            )}
            {roll.status === "Shooting" && roll.shots.length >= roll.frameCount && (
              <Text style={s.rollFull}>Roll full — {roll.frameCount} frames logged.</Text>
            )}
          </>
        }
      />

      {/* FABs — quick log (⚡) and full log (+), only while shooting */}
      {roll.status === "Shooting" && roll.shots.length < roll.frameCount && (
        <View style={s.fabRow}>
          <TouchableOpacity
            style={s.fabQuick}
            onPress={handleQuickLog}
            disabled={quickLogging}
          >
            {quickLogging
              ? <ActivityIndicator color={COLORS.amber} size="small" />
              : <Text style={s.fabQuickText}>⚡</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.fab} onPress={() => setLogOpen(true)}>
            <Text style={s.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <FilmStripModal
        visible={filmStripOpen}
        roll={roll}
        filmStockName={filmStocks.find((f) => f.id === roll.filmStockId)?.name ?? roll.filmStockId}
        onClose={() => setFilmStripOpen(false)}
        onFramePress={(shotId) => { setFilmStripOpen(false); setEditingShotId(shotId); }}
      />
      <RollMapModal
        visible={mapOpen}
        shots={roll.shots}
        onClose={() => setMapOpen(false)}
        onMarkerPress={(shotId) => { setMapOpen(false); setEditingShotId(shotId); }}
      />
      <LogFrameModal
        visible={logOpen}
        frameNumber={roll.shots.length + 1}
        onSave={(shot) => addShot(roll.id, shot)}
        onClose={() => setLogOpen(false)}
      />
      <EditRollModal
        visible={editOpen}
        rollId={roll.id}
        onClose={() => setEditOpen(false)}
      />
      <EditShotModal
        key="edit-shot-modal"
        visible={!!editingShotId}
        shot={roll.shots.find((s) => s.id === editingShotId) ?? null}
        rollId={roll.id}
        rollStatus={roll.status}
        isLastFrame={
          !!editingShotId &&
          roll.shots.find((s) => s.id === editingShotId)?.frame ===
            Math.max(...roll.shots.map((s) => s.frame))
        }
        onClose={() => setEditingShotId(null)}
      />

      {/* ── Lightbox ───────────────────────────────────────────────────────── */}
      <Modal
        visible={!!lightboxShotId}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxShotId(null)}
      >
        <View style={s.lbOverlay}>
          {/* Close */}
          <TouchableOpacity style={s.lbClose} onPress={() => setLightboxShotId(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.lbCloseText}>✕</Text>
          </TouchableOpacity>

          {/* Counter */}
          {scannedShots.length > 1 && (
            <Text style={s.lbCounter}>
              {lbIdx + 1} / {scannedShots.length}
            </Text>
          )}

          {/* Left arrow */}
          {scannedShots.length > 1 && (
            <TouchableOpacity
              style={[s.lbArrow, s.lbArrowLeft, lbIdx <= 0 && s.lbArrowHidden]}
              onPress={() => lbIdx > 0 && setLightboxShotId(scannedShots[lbIdx - 1].id)}
              disabled={lbIdx <= 0}
              hitSlop={{ top: 20, bottom: 20, left: 8, right: 8 }}
            >
              <Text style={s.lbArrowText}>‹</Text>
            </TouchableOpacity>
          )}

          {/* Image */}
          {lbShot?.scanUri && (
            <ScanThumb path={lbShot.scanUri} style={s.lbImage} resizeMode="contain" />
          )}

          {/* Right arrow */}
          {scannedShots.length > 1 && (
            <TouchableOpacity
              style={[s.lbArrow, s.lbArrowRight, lbIdx >= scannedShots.length - 1 && s.lbArrowHidden]}
              onPress={() => lbIdx < scannedShots.length - 1 && setLightboxShotId(scannedShots[lbIdx + 1].id)}
              disabled={lbIdx >= scannedShots.length - 1}
              hitSlop={{ top: 20, bottom: 20, left: 8, right: 8 }}
            >
              <Text style={s.lbArrowText}>›</Text>
            </TouchableOpacity>
          )}

          {/* Bottom info */}
          <View style={s.lbInfo}>
            <Text style={s.lbFrame}>Frame {String(lbShot?.frame ?? 0).padStart(2, "0")}</Text>
            {lbShot?.subject ? <Text style={s.lbSubject}>{lbShot.subject}</Text> : null}
            {lbShot?.rating ? (
              <Text style={s.lbRating}>
                {"★".repeat(lbShot.rating)}{"☆".repeat(MAX_STARS - lbShot.rating)}
              </Text>
            ) : null}
            {Platform.OS === "web" && scannedShots.length > 1 && (
              <Text style={s.lbKeyHint}>← →  navigate  ·  esc  close</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  notFound: { color: COLORS.textMuted, fontFamily: "Courier New" },
  list: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  rollName: { fontSize: 11, color: COLORS.amber, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 4 },
  filmName: { fontSize: 15, fontWeight: "bold", color: COLORS.textPrimary, fontFamily: "Courier New" },
  meta: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  rollLocation: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 4 },
  shotCount: { fontSize: 28, fontWeight: "bold", color: COLORS.amber, fontFamily: "Courier New" },
  shotCountLabel: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New" },

  progressBg: { height: 2, backgroundColor: COLORS.bgElevated, marginBottom: 14 },
  progressFill: { height: "100%", backgroundColor: COLORS.amber },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Courier New" },
  advanceBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.amberDim },
  advanceText: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },

  actionRow: { flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 12 },
  actionBtn: {},
  actionEdit: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New" },
  actionDelete: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New" },
  confirmText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", marginRight: 8 },

  importBtn: {
    borderWidth: 1, borderColor: COLORS.amberDim,
    paddingVertical: 10, alignItems: "center", marginBottom: 16,
  },
  importBtnText: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1.5, textTransform: "uppercase" },
  rollActions: { flexDirection: "row" as const, gap: 8, marginBottom: 16 },
  rollActionBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 10, alignItems: "center" as const,
  },
  rollActionText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1.5, textTransform: "uppercase" as const },
  filmStripBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 10, alignItems: "center", marginBottom: 16,
  },
  filmStripBtnText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1.5, textTransform: "uppercase" },

  sectionTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  emptyShots: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", lineHeight: 18 },
  rollFull: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", marginTop: 8 },
  shotEditHint: { fontSize: 16, color: COLORS.textDim, alignSelf: "center" },

  shotRow: {
    flexDirection: "row", paddingVertical: 10, alignItems: "flex-start",
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, gap: 12,
  },
  shotThumb: { width: 72, height: 72 },
  shotThumbEmpty: {
    width: 72, height: 72,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  shotThumbNum: { fontSize: 16, color: COLORS.amberDim, fontFamily: "Courier New", fontWeight: "bold" },
  shotFields: { flex: 1, paddingTop: 2 },
  shotFieldsTop: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 3 },
  shotFrameTag: { fontSize: 9, color: COLORS.amberDim, fontFamily: "Courier New", letterSpacing: 1 },
  shotExposure: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  shotLighting: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  shotSubject: { fontSize: 11, color: COLORS.textSecondary, fontFamily: "Courier New", marginTop: 3 },
  shotNotes: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 4, fontStyle: "italic", lineHeight: 15 },
  shotPin: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 3, letterSpacing: 0.3 },
  shotMeta: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2, fontStyle: "italic", letterSpacing: 0.3 },
  shotStars: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", marginTop: 3, letterSpacing: 1 },
  shotTags: { fontSize: 9, color: COLORS.amberDim, fontFamily: "Courier New", marginTop: 2, letterSpacing: 0.5 },

  // Zoom hint overlay on thumbnail
  shotThumbZoomHint: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 4, paddingVertical: 2,
  },
  shotThumbZoomIcon: { fontSize: 9, color: "rgba(255,255,255,0.8)" },

  // Lightbox
  lbOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.97)",
    alignItems: "center", justifyContent: "center",
  },
  lbImage: { width: "100%", flex: 1 },
  lbClose: {
    position: "absolute", top: 48, right: 20, zIndex: 10,
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
  },
  lbCloseText: { fontSize: 20, color: "rgba(255,255,255,0.65)", fontFamily: "Courier New" },
  lbCounter: {
    position: "absolute", top: 54,
    left: 0, right: 0, textAlign: "center",
    fontFamily: "Courier New", fontSize: 10,
    color: "rgba(255,255,255,0.35)", letterSpacing: 2,
  },
  lbArrow: {
    position: "absolute", top: 0, bottom: 0,
    width: 64, alignItems: "center", justifyContent: "center",
    zIndex: 5,
  },
  lbArrowLeft: { left: 0 },
  lbArrowRight: { right: 0 },
  lbArrowHidden: { opacity: 0 },
  lbArrowText: { fontSize: 52, color: "rgba(255,255,255,0.55)", lineHeight: 56 },
  lbInfo: {
    position: "absolute", bottom: 44,
    left: 0, right: 0,
    alignItems: "center", gap: 5,
  },
  lbFrame: {
    fontFamily: "Courier New", fontSize: 11,
    color: COLORS.amber, letterSpacing: 2,
  },
  lbSubject: {
    fontFamily: "Courier New", fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },
  lbRating: { fontSize: 14, color: COLORS.amber, letterSpacing: 2 },
  lbKeyHint: {
    fontFamily: "Courier New", fontSize: 9,
    color: "rgba(255,255,255,0.2)", letterSpacing: 1.5, marginTop: 4,
  },

  fabRow: {
    position: "absolute", bottom: 24, right: 24,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  fabQuick: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.amber,
    alignItems: "center", justifyContent: "center",
  },
  fabQuickText: { fontSize: 20, lineHeight: 24 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.amber, alignItems: "center", justifyContent: "center",
    shadowColor: COLORS.amber, shadowOpacity: 0.5, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: 28, color: COLORS.bg, fontWeight: "bold", lineHeight: 32 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.bgElevated, borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: "90%", padding: 24 },
  innerSheet: { backgroundColor: COLORS.bgElevated, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 11, color: COLORS.amber, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 16 },
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  inputMulti: { height: 64, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10 },
  picker: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  pickerPlaceholder: { fontSize: 13, color: COLORS.textDim, fontFamily: "Courier New" },
  pickerArrow: { fontSize: 20, color: COLORS.textDim },
  segmented: { flexDirection: "row", gap: 8, marginBottom: 4 },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  segmentActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  segmentText: { fontSize: 13, color: COLORS.textMuted, fontFamily: "Courier New" },
  segmentTextActive: { color: COLORS.textPrimary },
  errorText: { fontSize: 10, color: COLORS.danger, fontFamily: "Courier New", lineHeight: 16, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 16 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.amber, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, alignItems: "center" },
  btnSecondaryText: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  btnDisabled: { opacity: 0.4 },
  option: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  optionActive: { backgroundColor: COLORS.bgCard },
  optionText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New" },
  optionTextActive: { color: COLORS.amber },
  optionSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: "center" },
  cancelText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  deleteRow: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 16, marginTop: 4, marginBottom: 16,
  },
  deleteBtn: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 1 },
  deleteBtnRect: {
    backgroundColor: COLORS.danger, paddingVertical: 12,
    alignItems: "center" as const, width: "100%" as any,
  },
  deleteBtnRectText: {
    color: "#f0e6d0", fontFamily: "Courier New",
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase" as const,
  },
  deleteConfirmText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
  deleteBtnYes: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New" },
  deleteBtnNo: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New" },
  scanContainer: { marginBottom: 4 },
  scanPreview: { width: "100%" as any, height: 180, backgroundColor: COLORS.bgCard },
  scanRemoveBtn: { marginTop: 6, alignSelf: "flex-end" as const },
  scanRemoveText: { fontSize: 10, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 0.5 },
  scanAttachBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed" as const,
    alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: COLORS.bg,
  },
  scanAttachText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
  scanSection: { marginBottom: 12 },
  cardScroll: { marginBottom: 12 },
  cardRow: { flexDirection: "row" as const, gap: 16, alignItems: "flex-start" as const },
  fieldsCol: { justifyContent: "flex-start" as const },
  fieldsRow: { flexDirection: "row" as const, gap: 8, marginBottom: 2 },
  fieldCell: { width: 250 },
  notesCell: { width: 508 },
  scanAttachIcon: { fontSize: 24, color: COLORS.textDim, lineHeight: 28 },
  scanAttachLabel: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", letterSpacing: 1, textTransform: "uppercase" as const, marginTop: 4 },
  orientRow: { flexDirection: "row" as const, gap: 8, marginTop: 8 },
  orientBtn: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  orientBtnActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  orientBtnText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1, textTransform: "uppercase" as const },
  orientBtnTextActive: { color: COLORS.textPrimary },
  resolveBtn: {
    width: 42, borderWidth: 1, borderColor: COLORS.amber,
    alignItems: "center", justifyContent: "center",
  },
  resolveBtnText: { fontSize: 16 },
  resolvedCoords: {
    fontSize: 9, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 0.5, marginTop: 4,
  },
  starRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  star: { fontSize: 24, color: COLORS.border },
  starFilled: { color: COLORS.amber },
  tagInputRow: { flexDirection: "row", gap: 8 },
  tagAddBtn: {
    width: 42, borderWidth: 1, borderColor: COLORS.amber,
    alignItems: "center", justifyContent: "center",
  },
  tagAddText: { fontSize: 20, color: COLORS.amber, lineHeight: 24 },
  tagChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.amberDim,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  tagChipText: { fontSize: 10, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 0.5 },
  scanZoomHint: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  scanZoomHintText: { fontSize: 14, color: "#fff" },
  // Internal scan lightbox
  scanLbOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center", justifyContent: "center",
  },
  scanLbClose: { position: "absolute", top: 16, right: 16, padding: 8, zIndex: 2 },
  scanLbCloseText: { fontSize: 20, color: "rgba(255,255,255,0.85)" },
  scanLbImageWrap: { width: "100%", flex: 1, paddingHorizontal: 16, paddingVertical: 48 },
  scanLbImage: { width: "100%", height: "100%" },
  scanLbHint: {
    fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "Courier New",
    letterSpacing: 0.8, paddingBottom: 20,
  },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  toggleSub: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
});

// ── Film strip stylesheet ─────────────────────────────────────────────────────

const PHOTO_W    = 120;
const PHOTO_H    = 80;   // 3:2 landscape — matches real 35mm frame proportion
const BRAND_H    = 7;
const HOLE_W     = 7;     // whole number avoids pixel-rounding size differences
const HOLE_H     = 9.5;
// FRAME_W = PHOTO_W + 5: the inter-frame gap is 5px (PHOTO_W+20 original → /4 = 5)
const FRAME_W    = PHOTO_W + 5;
// Slot width per hole so all 8 per frame align evenly across the strip
const HOLE_SLOT  = FRAME_W / 8;           // 15.625
const HOLE_GAP   = HOLE_SLOT - HOLE_W;    // 8.625 — equal gap between every hole
// Outer pad (hole → film edge) = 7; inner pad (hole → photo) = 7/4 = 1.75
const SPROCKET_OUTER = 7;
const SPROCKET_INNER = 1.75;
const SPROCKET_H = SPROCKET_OUTER + HOLE_H + SPROCKET_INNER; // 18.25

const fs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bgElevated,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 20, paddingBottom: 32,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, marginBottom: 16,
  },
  headerTitle: {
    fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New", letterSpacing: 1,
  },
  headerSub: {
    fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 0.5, marginTop: 2,
  },
  closeBtn: { fontSize: 16, color: COLORS.textDim, paddingLeft: 16 },

  stripScroll: { flexGrow: 0 },
  stripContent: { paddingHorizontal: 20 },

  stripBody: {
    backgroundColor: "#6b2810",
    borderWidth: 1, borderColor: "#3d1608",
  },
  brandStripe: { height: BRAND_H },
  sprocketRow: {
    height: SPROCKET_H,
    backgroundColor: "transparent",
  },
  sprocketHole: {
    width: HOLE_W, height: HOLE_H,
    backgroundColor: "#f0ebe0",
    borderRadius: 1,
  },

  framesRow: { flexDirection: "row" },
  frameCell: {
    width: FRAME_W,
    paddingVertical: 0,
    paddingHorizontal: (FRAME_W - PHOTO_W) / 2,
    backgroundColor: "transparent",
  },
  framePhoto: { width: PHOTO_W, height: PHOTO_H },
  frameEmpty: {
    width: PHOTO_W, height: PHOTO_H,
    backgroundColor: "#080808",
    borderWidth: 0,
  },

  numbersRow: { flexDirection: "row", paddingTop: 6 },
  numberCell: { width: FRAME_W, alignItems: "center" },
  numberText: { fontSize: 9, fontFamily: "Courier New", letterSpacing: 1 },

  closeFullBtn: {
    marginTop: 20, marginHorizontal: 20,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 12, alignItems: "center",
  },
  closeFullBtnText: {
    fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  frameCellFocused: {
    borderWidth: 2, borderColor: COLORS.amber,
  },
  keyHint: {
    fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New",
    letterSpacing: 0.8, textAlign: "center", marginTop: 10,
  },
  // Internal lightbox
  lbOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center", justifyContent: "center",
  },
  lbClose: { position: "absolute", top: 16, right: 16, padding: 8, zIndex: 2 },
  lbCloseText: { fontSize: 20, color: "rgba(255,255,255,0.85)" },
  lbCounter: {
    position: "absolute", top: 20, alignSelf: "center",
    fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "Courier New", letterSpacing: 1,
  },
  lbImageWrap: { width: "100%", flex: 1, paddingHorizontal: 16, paddingVertical: 56 },
  lbImage: { width: "100%", height: "100%" },
  lbFrameLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "Courier New",
    letterSpacing: 1, marginBottom: 8,
  },
  lbHint: {
    fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Courier New",
    letterSpacing: 0.8, marginBottom: 20,
  },
});

// ── Roll map stylesheet ───────────────────────────────────────────────────────

const mp = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 13, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 2, textTransform: "uppercase" },
  closeBtn: { fontSize: 20, color: COLORS.textDim, paddingLeft: 16 },
  map: { flex: 1 },
  markerBubble: {
    backgroundColor: COLORS.amber, paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 2,
  },
  markerText: { fontSize: 10, color: COLORS.bg, fontFamily: "Courier New", fontWeight: "bold" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyText: { fontSize: 12, color: COLORS.textDim, fontFamily: "Courier New", textAlign: "center", lineHeight: 20 },
  list: { flex: 1 },
  listRow: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  listFrame: { fontSize: 11, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 1 },
  listCoord: { fontSize: 10, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },
});
