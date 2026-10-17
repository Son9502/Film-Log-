import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { updatePassword } from "@/services/supabase";
import { COLORS } from "@/constants";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Supabase processes the token in the URL hash immediately on page load —
  // before this component mounts — so the PASSWORD_RECOVERY event is often
  // already gone by the time the listener registers. We fix this with two
  // strategies running in parallel:
  //   1. getSession() checks whether Supabase already set a session from the token.
  //   2. onAuthStateChange catches it if the event fires after mount.
  // A timeout surfaces an error if the link is expired or invalid.
  useEffect(() => {
    let settled = false;

    function markReady() {
      if (settled) return;
      settled = true;
      clearTimeout(expiry);
      setReady(true);
    }

    const expiry = setTimeout(() => {
      if (!settled) {
        settled = true;
        setError("This reset link has expired or is invalid. Please request a new one.");
      }
    }, 8000);

    // Strategy 1: session already established before mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    // Strategy 2: event fires after mount (native deep link, slower networks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") markReady();
    });

    return () => {
      settled = true;
      clearTimeout(expiry);
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpdate() {
    setError(null);
    if (!password.trim())    { setError("Enter a new password."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Password Updated</Text>
        <Text style={s.subtitle}>
          Your password has been changed.{"\n"}Sign in with your new credentials.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
          <Text style={s.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={s.container}>
        {error ? (
          <>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
              <Text style={s.primaryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator color={COLORS.amber} size="large" />
            <Text style={s.waiting}>Verifying reset link…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>New Password</Text>
      <Text style={s.subtitle}>Choose a strong password for your account.</Text>

      {error && <Text style={s.error}>{error}</Text>}

      <Text style={s.label}>New Password</Text>
      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Min. 8 characters"
        placeholderTextColor={COLORS.textDim}
        secureTextEntry
        autoFocus
      />

      <Text style={s.label}>Confirm Password</Text>
      <TextInput
        style={s.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-enter password"
        placeholderTextColor={COLORS.textDim}
        secureTextEntry
      />

      <TouchableOpacity
        style={[s.primaryBtn, loading && s.btnDisabled]}
        onPress={handleUpdate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.primaryBtnText}>Update Password</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bg,
    padding: 24, justifyContent: "center",
  },
  title: {
    fontSize: 22, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 4, textTransform: "uppercase", marginBottom: 4,
  },
  subtitle: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New",
    marginBottom: 32, lineHeight: 18,
  },
  label: {
    fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  primaryBtn: {
    marginTop: 24, backgroundColor: COLORS.amber,
    paddingVertical: 14, alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: COLORS.bg, fontFamily: "Courier New",
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
  },
  error: {
    fontSize: 11, color: COLORS.danger, fontFamily: "Courier New",
    marginBottom: 8, lineHeight: 18,
  },
  waiting: {
    marginTop: 16, fontSize: 11, color: COLORS.textDim,
    fontFamily: "Courier New", textAlign: "center",
  },
});
