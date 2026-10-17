// ── ID generation ─────────────────────────────────────────────────────────────
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Date formatting ───────────────────────────────────────────────────────────
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Frame validation ──────────────────────────────────────────────────────────
/**
 * Returns an error message if reducing frameCount would orphan existing shots.
 * Returns null if the change is safe.
 */
export function validateFrameCountChange(
  currentShots: number,
  newFrameCount: number
): string | null {
  if (newFrameCount < currentShots) {
    return `This roll has ${currentShots} frames already logged. Reducing to ${newFrameCount} would exceed the frame count. Delete excess frames first, or choose a higher count.`;
  }
  return null;
}

// ── Roll progress ─────────────────────────────────────────────────────────────
export function rollProgress(shotCount: number, frameCount: number): number {
  return Math.min(1, shotCount / Math.max(1, frameCount));
}

// ── Status color map ─────────────────────────────────────────────────────────
export function statusColors(status: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    Stock:     { bg: "#1a2a1a", fg: "#4a8a4a" },
    Shooting:  { bg: "#2a1a00", fg: "#b8860b" },
    "At Lab":  { bg: "#1a1a2a", fg: "#4a4a8a" },
    Developed: { bg: "#2a2a2a", fg: "#aaaaaa" },
    Archived:  { bg: "#1a1a1a", fg: "#444444" },
  };
  return map[status] ?? { bg: "#1a1a1a", fg: "#666" };
}
