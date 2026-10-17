import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { signUp } from "@/services/supabase";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";

function validatePassword(pw: string): string | null {
  if (pw.length < 8)          return "At least 8 characters required.";
  if (!/[A-Z]/.test(pw))      return "Must include an uppercase letter.";
  if (!/[0-9]/.test(pw))      return "Must include a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Must include a symbol (e.g. !@#$%).";
  return null;
}

// Visual strength indicator
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)            score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  const levels = [
    { label: "",         color: COLORS.border },
    { label: "Weak",     color: COLORS.danger },
    { label: "Fair",     color: "#b86b0b" },
    { label: "Good",     color: COLORS.amberLight },
    { label: "Strong",   color: COLORS.success },
  ];
  return { score, ...levels[score] };
}

export default function SignupScreen() {
  const router = useRouter();
  const { setUser, uploadLocalToSupabase } = useFilmLogStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = passwordStrength(password);

  async function handleSignup() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await signUp(email.trim(), password.trim());
      const sbUser = data.user;
      if (sbUser) {
        setUser({ id: sbUser.id, email: sbUser.email ?? "" });
        await uploadLocalToSupabase(sbUser.id);
        router.replace("/(tabs)");
      } else {
        setSuccess(true);
      }
    } catch (e: any) {
      setError(e.message ?? "Sign up failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Almost there!</Text>
        <Text style={s.subtitle}>
          We sent a confirmation link to {email}.{"\n\n"}
          Click it to activate your account — it only takes a second. Then come back and sign in.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth/login")}>
          <Text style={s.primaryBtnText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Create Account</Text>
      <Text style={s.subtitle}>Your data syncs across all your devices</Text>

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
        placeholder="Min. 8 chars, uppercase, number, symbol"
        placeholderTextColor={COLORS.textDim}
        secureTextEntry
      />

      {/* Strength bar */}
      {password.length > 0 && (
        <View style={s.strengthRow}>
          <View style={s.strengthBarBg}>
            <View style={[s.strengthBarFill, { width: `${strength.score * 25}%`, backgroundColor: strength.color }]} />
          </View>
          <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      )}

      <Text style={s.label}>Confirm Password</Text>
      <TextInput
        style={s.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="••••••••"
        placeholderTextColor={COLORS.textDim}
        secureTextEntry
      />

      <TouchableOpacity style={s.primaryBtn} onPress={handleSignup} disabled={loading}>
        {loading
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.primaryBtnText}>Create Account</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={() => router.back()}>
        <Text style={s.linkText}>Already have an account? Sign in →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 4, textTransform: "uppercase", marginBottom: 4 },
  subtitle: { fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New", marginBottom: 32, lineHeight: 18 },
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "Courier New", marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  strengthBarBg: { flex: 1, height: 3, backgroundColor: COLORS.border },
  strengthBarFill: { height: "100%" },
  strengthLabel: { fontSize: 9, fontFamily: "Courier New", letterSpacing: 1, width: 44, textAlign: "right" },
  primaryBtn: { marginTop: 24, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New" },
  error: { fontSize: 11, color: COLORS.danger, fontFamily: "Courier New", marginBottom: 8, lineHeight: 18 },
});
