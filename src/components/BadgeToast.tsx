import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";

const DISPLAY_MS = 5500;
const FADE_MS    = 280;

export function BadgeToast() {
  const notifications       = useFilmLogStore((s) => s.notifications);
  const dismissNotification = useFilmLogStore((s) => s.dismissNotification);
  const current = notifications[0] ?? null;

  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const dismiss = (id: string) => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: FADE_MS, useNativeDriver: true }),
    ]).start(() => dismissNotification(id));
  };

  useEffect(() => {
    if (!current) return;
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => dismiss(current.id), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [current?.id]);

  if (!current) return null;

  const isWalk  = current.type === "walk_completed";
  const isBadge = current.type === "badge_earned";

  const innerStyle = isWalk  ? s.innerWalk
                   : isBadge ? s.innerBadge
                              : s.innerProgress;
  const accentStyle = isWalk  ? s.accentWalk
                    : isBadge ? s.accentBadge
                               : s.accentProgress;
  const titleStyle = isWalk  ? s.titleWalk
                   : isBadge ? s.titleBadge
                              : s.titleProgress;

  return (
    <Animated.View
      style={[s.toast, { opacity, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => dismiss(current.id)}
        style={[s.inner, innerStyle]}
      >
        <View style={[s.accent, accentStyle]} />
        <Text style={s.emoji}>{current.emoji}</Text>
        <View style={s.text}>
          <Text style={[s.title, titleStyle]} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={s.message} numberOfLines={2}>
            {current.message}
          </Text>
          {current.subtitle != null && (
            <Text style={[s.subtitle, titleStyle]}>{current.subtitle}</Text>
          )}
          {current.subtext != null && (
            <Text style={s.subtext} numberOfLines={2}>
              "{current.subtext}"
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 96,
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  inner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  innerBadge:    { backgroundColor: "#1a1208", borderColor: "#b8830a" },
  innerProgress: { backgroundColor: "#0d1418", borderColor: "#2a6b8a" },
  innerWalk:     { backgroundColor: "#0e1510", borderColor: "#2e7d3e" },
  accent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  accentBadge:    { backgroundColor: COLORS.amber },
  accentProgress: { backgroundColor: "#4a9bbe" },
  accentWalk:     { backgroundColor: "#4caf63" },
  emoji: {
    fontSize: 26,
    lineHeight: 32,
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 11,
    fontFamily: "Courier New",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  titleBadge:    { color: COLORS.amber },
  titleProgress: { color: "#4a9bbe" },
  titleWalk:     { color: "#4caf63" },
  message: {
    fontSize: 11,
    fontFamily: "Courier New",
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Courier New",
    letterSpacing: 2,
    marginTop: 1,
  },
  subtext: {
    fontSize: 10,
    fontFamily: "Courier New",
    color: COLORS.textMuted,
    fontStyle: "italic",
    lineHeight: 15,
    marginTop: 1,
  },
});
