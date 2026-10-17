import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { signOut } from "@/services/supabase";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, clearUserData } = useFilmLogStore();

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>General</Text>
      <TouchableOpacity style={s.row} onPress={() => router.push("/settings/gear")}>
        <View>
          <Text style={s.rowLabel}>My Gear</Text>
          <Text style={s.rowSub}>Cameras &amp; film stocks</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={() => router.push("/settings/stats")}>
        <View>
          <Text style={s.rowLabel}>Stats &amp; Badges</Text>
          <Text style={s.rowSub}>Overview &amp; achievements</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={() => router.push("/settings/profile")}>
        <View>
          <Text style={s.rowLabel}>My Profile</Text>
          <Text style={s.rowSub}>Handle, bio &amp; public visibility</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>

      <Text style={[s.sectionLabel, { marginTop: 28 }]}>Account</Text>
      <View style={s.accountCard}>
        <Text style={s.accountFieldLabel}>Signed in as</Text>
        <Text style={s.accountEmail}>{user?.email}</Text>
      </View>
      <TouchableOpacity
        style={s.signOutBtn}
        onPress={async () => {
          await signOut();
          clearUserData();
        }}
      >
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  rowLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  rowSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  arrow: { fontSize: 20, color: COLORS.textDim },

  accountCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 14,
  },
  accountFieldLabel: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4,
  },
  accountEmail: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },

  signOutBtn: {
    borderWidth: 1, borderColor: COLORS.danger,
    paddingVertical: 12, alignItems: "center",
  },
  signOutText: {
    fontSize: 11, color: COLORS.danger, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase",
  },
});
