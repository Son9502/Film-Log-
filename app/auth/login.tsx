import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signIn, signOut, resetPassword } from "@/services/supabase";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";

function resetRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/reset-password`;
  }
  return Linking.createURL("/auth/reset-password");
}

export default function LoginScreen() {
  const router = useRouter();
  const { user, setUser, syncFromSupabase, uploadLocalToSupabase, clearUserData, clearAllData } = useFilmLogStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── Logged-in view ──────────────────────────────────────────────────────────
  if (user) {
    return (
      <View style={s.container}>
        <Text style={s.sectionTitle}>Account</Text>
        <View style={s.card}>
          <Text style={s.label}>Signed in as</Text>
          <Text style={s.email}>{user.email}</Text>
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

  // ── Forgot password view ────────────────────────────────────────────────────
  if (forgotMode) {
    if (resetSent) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Check your email</Text>
          <Text style={s.subtitle}>
            If an account exists with the email {email}, you should have received a password reset link. Please follow the link to choose a new password.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => { setForgotMode(false); setResetSent(false); }}>
            <Text style={s.primaryBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.container}>
        <Text style={s.title}>Reset Password</Text>
        <Text style={s.subtitle}>Enter your email and we'll send you a reset link.</Text>

        {error && <Text style={s.error}>{error}</Text>}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />

        <TouchableOpacity
          style={s.primaryBtn}
          disabled={loading}
          onPress={async () => {
            setError(null);
            if (!email.trim()) { setError("Enter your email address."); return; }
            setLoading(true);
            try {
              await resetPassword(email.trim(), resetRedirectUrl());
              setResetSent(true);
            } catch (e: any) {
              setError(e.message ?? "Could not send reset email.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading
            ? <ActivityIndicator color={COLORS.bg} />
            : <Text style={s.primaryBtnText}>Send Reset Link</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => { setForgotMode(false); setError(null); }}>
          <Text style={s.linkText}>← Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Login form ──────────────────────────────────────────────────────────────
  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await signIn(email.trim(), password.trim());
      const sbUser = data.user;
      if (sbUser) {
        const storedUserId = await AsyncStorage.getItem("filmlog:userId");
        setUser({ id: sbUser.id, email: sbUser.email ?? "" });
        if (storedUserId && storedUserId !== sbUser.id) {
          // Different account on this device — wipe local rolls so they don't bleed in
          clearAllData();
        } else {
          // Same user (or first sign-in) — push any local rolls to Supabase first
          await uploadLocalToSupabase(sbUser.id);
        }
        await syncFromSupabase(sbUser.id);
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Sign in failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Film Log</Text>
      <Text style={s.subtitle}>Sign in to sync across devices</Text>

      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={COLORS.textDim}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={s.label}>Password</Text>
      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={COLORS.textDim}
        secureTextEntry
      />

      <TouchableOpacity style={s.primaryBtn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.primaryBtnText}>Sign In</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={() => { setForgotMode(true); setError(null); }}>
        <Text style={s.linkText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/auth/signup")}>
        <Text style={s.linkText}>No account? Create one →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 4, textTransform: "uppercase", marginBottom: 4 },
  subtitle: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", marginBottom: 32, lineHeight: 18 },
  sectionTitle: { fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtn: { marginTop: 24, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  linkBtn: { marginTop: 14, alignItems: "center" },
  linkText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
  error: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", marginBottom: 8, lineHeight: 18 },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 24 },
  email: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New", marginTop: 4 },
  signOutBtn: { borderWidth: 1, borderColor: COLORS.danger, paddingVertical: 12, alignItems: "center" },
  signOutText: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", letterSpacing: 2, textTransform: "uppercase" },
});
