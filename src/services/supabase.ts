import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ── Supabase project values come from .env (see .env.example) ────────────────
// Found in: Supabase Dashboard → Project Settings → API
// Expo inlines EXPO_PUBLIC_* at build time, so these must be read as literal
// `process.env.EXPO_PUBLIC_…` expressions (no destructuring).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase config. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo with `npx expo start -c`.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,         // Persist session on device
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",  // true on web (parses reset/magic-link tokens from URL), false on native
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function resetPassword(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadScan(
  userId: string,
  rollId: string,
  shotId: string,
  localUri: string,
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${rollId}/${shotId}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from("scans").upload(path, blob, {
    contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function getScanUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteScan(path: string): Promise<void> {
  const { error } = await supabase.storage.from("scans").remove([path]);
  if (error) throw error;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
