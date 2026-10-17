import {
  View, Text, TextInput, TouchableOpacity, Switch, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { uploadAvatar } from "@/services/supabase";

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, myProfile, saveProfile } = useFilmLogStore();

  const [displayName, setDisplayName] = useState(myProfile?.displayName ?? "");
  const [handle, setHandle]           = useState(myProfile?.handle ?? "");
  const [bio, setBio]                 = useState(myProfile?.bio ?? "");
  const [isPublic, setPublic]         = useState(myProfile?.isPublic ?? false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    if (myProfile) {
      setDisplayName(myProfile.displayName ?? "");
      setHandle(myProfile.handle);
      setBio(myProfile.bio ?? "");
      setPublic(myProfile.isPublic);
    }
  }, [myProfile?.handle]);

  const handleDisplay = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

  const hasChanges =
    handleDisplay !== (myProfile?.handle ?? "") ||
    displayName.trim() !== (myProfile?.displayName ?? "") ||
    bio.trim() !== (myProfile?.bio ?? "") ||
    isPublic !== (myProfile?.isPublic ?? false) ||
    pendingAvatarUri !== null;

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingAvatarUri(result.assets[0].uri);
      setSaved(false);
      setError(null);
    }
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);

    let avatarUrl: string | undefined;
    if (pendingAvatarUri && user) {
      setAvatarUploading(true);
      try {
        avatarUrl = await uploadAvatar(user.id, pendingAvatarUri);
      } catch {
        setSaving(false);
        setAvatarUploading(false);
        setError("Avatar upload failed. Please try again.");
        return;
      }
      setAvatarUploading(false);
    }

    const result = await saveProfile({ handle, displayName, bio, isPublic, avatarUrl });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setPendingAvatarUri(null);
      setSaved(true);
    }
  }

  const currentAvatarUri = pendingAvatarUri ?? myProfile?.avatarUrl;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* Avatar */}
      <View style={s.avatarSection}>
        <TouchableOpacity style={s.avatarCircle} onPress={pickAvatar}>
          {currentAvatarUri ? (
            <Image source={{ uri: currentAvatarUri }} style={s.avatarImage} />
          ) : (
            <Text style={s.avatarPlaceholder}>
              {displayName.trim() ? displayName.trim().charAt(0).toUpperCase()
                : handle.trim() ? handle.trim().charAt(0).toUpperCase()
                : "?"}
            </Text>
          )}
          <View style={s.avatarEditBadge}>
            <Text style={s.avatarEditText}>Edit</Text>
          </View>
        </TouchableOpacity>
        {pendingAvatarUri && <Text style={s.avatarHint}>Photo selected — save to upload</Text>}
      </View>

      <Text style={s.sectionLabel}>Public Identity</Text>

      <View style={s.field}>
        <Text style={s.fieldLabel}>Display Name (optional)</Text>
        <TextInput
          style={s.input}
          value={displayName}
          onChangeText={(t) => { setDisplayName(t); setSaved(false); setError(null); }}
          placeholder="e.g. Silver Grain Studio"
          placeholderTextColor={COLORS.textDim}
          maxLength={40}
        />
        <Text style={s.hint}>Shown above your @handle on your profile</Text>
      </View>

      <View style={s.field}>
        <Text style={s.fieldLabel}>Handle</Text>
        <View style={s.handleRow}>
          <Text style={s.atSign}>@</Text>
          <TextInput
            style={s.handleInput}
            value={handle}
            onChangeText={(t) => { setHandle(t); setSaved(false); setError(null); }}
            placeholder="yourhandle"
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
        </View>
        {handleDisplay.length > 0 && handleDisplay !== handle.trim() && (
          <Text style={s.hint}>Will be saved as @{handleDisplay}</Text>
        )}
        <Text style={s.hint}>3–20 chars · letters, numbers, underscores only</Text>
      </View>

      <View style={s.field}>
        <Text style={s.fieldLabel}>Bio</Text>
        <TextInput
          style={s.bioInput}
          value={bio}
          onChangeText={(t) => { setBio(t); setSaved(false); setError(null); }}
          placeholder="A short note about you and your photography…"
          placeholderTextColor={COLORS.textDim}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        <Text style={[s.hint, { textAlign: "right" }]}>{bio.length}/200</Text>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>Visibility</Text>
      <View style={s.toggleRow}>
        <View>
          <Text style={s.toggleLabel}>Public profile</Text>
          <Text style={s.toggleSub}>Others can discover and view your profile</Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={(v) => { setPublic(v); setSaved(false); }}
          trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
          thumbColor={isPublic ? COLORS.amber : COLORS.textDim}
        />
      </View>

      {error && <Text style={s.errorText}>{error}</Text>}
      {saved && <Text style={s.savedText}>Profile saved.</Text>}

      <TouchableOpacity
        style={[s.saveBtn, (!hasChanges || saving) && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || saving}
      >
        {saving
          ? <ActivityIndicator color={COLORS.bg} size="small" />
          : <Text style={s.saveBtnText}>
              {avatarUploading ? "Uploading photo…" : myProfile ? "Save Changes" : "Create Profile"}
            </Text>
        }
      </TouchableOpacity>

      {myProfile && isPublic && (
        <>
          <Text style={[s.sectionLabel, { marginTop: 32 }]}>Your Public Profile</Text>
          <TouchableOpacity
            style={s.viewProfileBtn}
            onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: user!.id } })}
          >
            <Text style={s.viewProfileText}>View as others see it  ›</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const AVATAR_SIZE = 88;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },

  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarCircle: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: {
    fontSize: 32, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold",
  },
  avatarEditBadge: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 4, alignItems: "center",
  },
  avatarEditText: { fontSize: 9, color: "#fff", fontFamily: "Courier New", letterSpacing: 1 },
  avatarHint: {
    marginTop: 6, fontSize: 9, color: COLORS.amber, fontFamily: "Courier New",
  },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 14, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  field: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
  },

  handleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
  },
  atSign: {
    paddingLeft: 12, paddingRight: 4,
    fontSize: 14, color: COLORS.amber, fontFamily: "Courier New",
  },
  handleInput: {
    flex: 1, padding: 12,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 14,
  },

  bioInput: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 12,
    padding: 12, minHeight: 80, textAlignVertical: "top",
  },

  hint: { fontSize: 9, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 4 },

  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 8,
  },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  toggleSub: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 3 },

  errorText: {
    fontSize: 11, color: COLORS.danger, fontFamily: "Courier New",
    marginBottom: 12, textAlign: "center",
  },
  savedText: {
    fontSize: 11, color: COLORS.success, fontFamily: "Courier New",
    marginBottom: 12, textAlign: "center",
  },

  saveBtn: {
    backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 11, color: COLORS.bg, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold",
  },

  viewProfileBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 14, alignItems: "center",
  },
  viewProfileText: { fontSize: 12, color: COLORS.textPrimary, fontFamily: "Courier New", letterSpacing: 1 },
});
