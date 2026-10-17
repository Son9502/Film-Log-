import { Roll, Walk, WalkCompletion, WalkReview } from "@/types";
import { BADGES, BadgeDef } from "@/constants";
import { uid } from "@/utils";

// ── Stats type ────────────────────────────────────────────────────────────────
export type BadgeStats = Parameters<BadgeDef["check"]>[0];

// ── Compute stats from raw store state ────────────────────────────────────────
export function computeBadgeStats(
  rolls: Roll[],
  personalWalks: Walk[],
  completions: WalkCompletion[],
  myReviews: WalkReview[],
  userId: string | undefined
): BadgeStats {
  const allShots = rolls.flatMap((r) => r.shots);
  const locationLabels = new Set<string>();
  rolls.forEach((r) => {
    if (r.locationLabel) locationLabels.add(r.locationLabel.toLowerCase());
    r.shots.forEach((s) => {
      if (s.locationLabel) locationLabels.add(s.locationLabel.toLowerCase());
    });
  });
  return {
    rollCount:       rolls.length,
    frameCount:      allShots.length,
    stockCount:      new Set(rolls.map((r) => r.filmStockId)).size,
    cameraCount:     new Set(rolls.map((r) => r.cameraId)).size,
    locationCount:   locationLabels.size,
    finishedRolls:   rolls.filter((r) => r.shots.length >= r.frameCount).length,
    developedRolls:  rolls.filter((r) => r.developer).length,
    pushedRolls:     rolls.filter((r) => r.pushPull?.startsWith("+")).length,
    photoFloRolls:   rolls.filter((r) => r.photoFlo).length,
    allManualCount:  allShots.filter((s) => s.shutter && s.aperture && s.lighting).length,
    nightShotCount:  allShots.filter((s) => s.lighting === "Night").length,
    goldenHourCount: allShots.filter((s) => s.lighting === "Golden Hour").length,
    filterTypesUsed: new Set(allShots.map((s) => s.filter).filter(Boolean)).size,
    weatherTypesUsed:new Set(allShots.map((s) => s.weather).filter(Boolean)).size,
    scannedFrames:   allShots.filter((s) => s.scanUri).length,
    fullStripRolls:  rolls.filter((r) => r.shots.length > 0 && r.shots.every((s) => s.scanUri)).length,
    ratedFrames:     allShots.filter((s) => s.rating != null).length,
    taggedFrames:    allShots.filter((s) => s.tags && s.tags.length > 0).length,
    topRatedCount:   allShots.filter((s) => s.rating === 5).length,
    curatedRolls:    rolls.filter((r) => r.shots.length > 0 && r.shots.every((s) => s.rating != null)).length,
    uniqueTagCount:  new Set(allShots.flatMap((s) => s.tags ?? [])).size,
    quickLogCount:   allShots.filter((s) => !s.shutter && !s.aperture && !s.subject && !s.notes && s.location).length,
    completedWalks:  completions.length,
    walksCreatedWithTenCompletions: personalWalks.filter(
      (w) => w.createdByUserId === userId && w.completionCount >= 10
    ).length,
    walksRated: myReviews.length,
  };
}

// ── Notification object ───────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  type: "badge_earned" | "badge_progress" | "walk_completed";
  emoji: string;
  title: string;
  message: string;
  subtitle?: string;   // e.g. star rating line
  subtext?: string;    // e.g. review body (shown in italics)
}

// ── Badge earn copy ───────────────────────────────────────────────────────────
const BADGE_COPY: Record<string, { title: string; message: string }> = {
  first_frame:    { title: "First Frame",   message: "You've logged your first shot. The journey begins." },
  full_roll:      { title: "Full Roll",     message: "Your first roll is in the log." },
  finished_roll:  { title: "All the Way",   message: "Every frame accounted for. A complete roll, start to finish." },
  ten_rolls:      { title: "Ten Rolls",     message: "Double digits. You're building a proper archive." },
  fifty_rolls:    { title: "Fifty Rolls",   message: "Half a century. You're a committed shooter." },
  century:        { title: "Century",       message: "100 frames logged. You're only getting started." },
  five_hundred:   { title: "Five Hundred",  message: "500 frames. Impressive." },
  one_thousand:   { title: "One Thousand",  message: "A thousand frames. That's a dedicated photographer." },
  collector:      { title: "Collector",     message: "Five stocks tried. You know what you like — and what you don't." },
  multi_cam:      { title: "Multi-Cam",     message: "Three cameras in rotation. A tool for every job." },
  wanderer:       { title: "Wanderer",      message: "Five different locations shot. The world is your subject." },
  explorer:       { title: "Explorer",      message: "15 locations and counting. This camera goes everywhere." },
  full_manual:    { title: "Full Manual",   message: "Shutter, aperture, lighting. You're shooting with intention." },
  night_owl:      { title: "Night Owl",     message: "A frame in the dark. Some of the best light isn't light at all." },
  golden_hour:    { title: "Golden Hour",   message: "You caught the good light." },
  full_spectrum:  { title: "Full Spectrum", message: "Every filter type used. You've thought about everything." },
  weathered:      { title: "Weathered",     message: "Five weather conditions. You don't wait for perfect." },
  darkroom:       { title: "Darkroom",      message: "You developed your own roll. Respect." },
  push_it:        { title: "Push It",       message: "A pushed roll. Getting more out of your film." },
  photo_flo:      { title: "Photo-Flo",     message: "Clean negatives start with the last step. Good practice." },
  lab_rat:        { title: "Lab Rat",       message: "Five rolls developed. The darkroom is your second home." },
  first_scan:     { title: "First Scan",    message: "Your first negative digitised." },
  full_strip:     { title: "Full Strip",    message: "Every frame on a roll scanned. A complete archive." },
  critic:         { title: "Critic",        message: "Ten frames rated. You're developing an eye." },
  perfectionist:  { title: "Perfectionist", message: "Five five-star frames. You know a great shot when you see one." },
  curator:        { title: "Curator",       message: "Every frame on a roll rated. Ruthlessly honest." },
  tagger:         { title: "Tagger",        message: "20 frames tagged. Your archive is becoming searchable." },
  label_maker:    { title: "Label Maker",   message: "10 unique tags in use. A well-organised archive." },
  first_walk:     { title: "First Walk",    message: "Your first photo walk complete." },
  walker:         { title: "Walker",        message: "Five walks done. You know where to find the good spots." },
  trail_blazer:   { title: "Trail Blazer",  message: "A walk you created has 10 completions. You're a guide." },
  walk_critic:    { title: "Walk Critic",   message: "Five walks rated. The community appreciates it." },
};

// ── Progress nudge definitions ────────────────────────────────────────────────
interface ProgressNudgeDef {
  badgeId: string;
  statKey: keyof BadgeStats;
  threshold: number;
  emoji: string;
  message: string;
}

const PROGRESS_NUDGES: ProgressNudgeDef[] = [
  { badgeId: "ten_rolls",     statKey: "rollCount",          threshold: 5,   emoji: "📦", message: "5 rolls logged — halfway to Ten Rolls 📦" },
  { badgeId: "fifty_rolls",   statKey: "rollCount",          threshold: 25,  emoji: "🗂", message: "25 rolls logged — halfway to Fifty Rolls 🗂" },
  { badgeId: "century",       statKey: "frameCount",         threshold: 50,  emoji: "💯", message: "50 frames — halfway to Century 💯" },
  { badgeId: "five_hundred",  statKey: "frameCount",         threshold: 250, emoji: "🏆", message: "250 frames — halfway to Five Hundred 🏆" },
  { badgeId: "one_thousand",  statKey: "frameCount",         threshold: 500, emoji: "🏅", message: "500 frames — halfway to One Thousand 🏅" },
  { badgeId: "collector",     statKey: "stockCount",         threshold: 3,   emoji: "🧪", message: "3 film stocks tried — 2 more to unlock Collector 🧪" },
  { badgeId: "multi_cam",     statKey: "cameraCount",        threshold: 2,   emoji: "📷", message: "2 cameras in use — one more to earn Multi-Cam 📷" },
  { badgeId: "wanderer",      statKey: "locationCount",      threshold: 3,   emoji: "🌍", message: "3 locations shot — 2 more to earn Wanderer 🌍" },
  { badgeId: "explorer",      statKey: "locationCount",      threshold: 10,  emoji: "🗺", message: "10 locations — 5 more to earn Explorer 🗺" },
  { badgeId: "full_spectrum", statKey: "filterTypesUsed",    threshold: 5,   emoji: "🌈", message: "5 filter types used — halfway to Full Spectrum 🌈" },
  { badgeId: "weathered",     statKey: "weatherTypesUsed",   threshold: 3,   emoji: "☁️", message: "3 weather conditions — 2 more to earn Weathered ☁️" },
  { badgeId: "lab_rat",       statKey: "developedRolls",     threshold: 3,   emoji: "🏭", message: "3 rolls developed — 2 more to earn Lab Rat 🏭" },
  { badgeId: "critic",        statKey: "ratedFrames",        threshold: 5,   emoji: "⭐", message: "5 frames rated — halfway to Critic ⭐" },
  { badgeId: "perfectionist", statKey: "topRatedCount",      threshold: 3,   emoji: "🌟", message: "3 five-star frames — 2 more to earn Perfectionist 🌟" },
  { badgeId: "tagger",        statKey: "taggedFrames",       threshold: 10,  emoji: "🏷", message: "10 frames tagged — halfway to Tagger 🏷" },
  { badgeId: "label_maker",   statKey: "uniqueTagCount",     threshold: 5,   emoji: "🔖", message: "5 unique tags — halfway to Label Maker 🔖" },
  { badgeId: "walker",        statKey: "completedWalks",     threshold: 3,   emoji: "👟", message: "3 walks complete — 2 more to earn Walker 👟" },
  { badgeId: "walk_critic",   statKey: "walksRated",         threshold: 3,   emoji: "🗣", message: "3 walks rated — 2 more to earn Walk Critic 🗣" },
];

// ── Check for newly earned badges ─────────────────────────────────────────────
export function checkNewBadges(
  oldStats: BadgeStats,
  newStats: BadgeStats
): AppNotification[] {
  return BADGES
    .filter((b) => !b.check(oldStats) && b.check(newStats))
    .map((b) => {
      const copy = BADGE_COPY[b.id] ?? { title: b.name, message: b.description };
      return { id: uid(), type: "badge_earned" as const, emoji: b.emoji, title: copy.title, message: copy.message };
    });
}

// ── Check for progress nudges ─────────────────────────────────────────────────
export function checkProgressNudges(
  oldStats: BadgeStats,
  newStats: BadgeStats,
  shownNudges: string[],
  earnedBadgeIds: Set<string>
): { notifications: AppNotification[]; newShownKeys: string[] } {
  const notifications: AppNotification[] = [];
  const newShownKeys: string[] = [];
  for (const nudge of PROGRESS_NUDGES) {
    if (earnedBadgeIds.has(nudge.badgeId)) continue;
    if (shownNudges.includes(nudge.badgeId)) continue;
    const oldVal = oldStats[nudge.statKey] as number;
    const newVal = newStats[nudge.statKey] as number;
    if (oldVal < nudge.threshold && newVal >= nudge.threshold) {
      notifications.push({
        id: uid(), type: "badge_progress", emoji: nudge.emoji,
        title: "Getting closer", message: nudge.message,
      });
      newShownKeys.push(nudge.badgeId);
    }
  }
  return { notifications, newShownKeys };
}

// ── All-in-one: compute every notification from a before/after state change ───
export function computeBadgeNotifications(
  oldStats: BadgeStats,
  rolls: Roll[],
  personalWalks: Walk[],
  completions: WalkCompletion[],
  myReviews: WalkReview[],
  userId: string | undefined,
  shownNudges: string[],
  rollIdForAllTheWay?: string
): { notifications: AppNotification[]; newShownKeys: string[] } {
  const newStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, userId);
  const earnedIds = new Set(BADGES.filter((b) => b.check(newStats)).map((b) => b.id));

  const badgeNotifs = checkNewBadges(oldStats, newStats);
  const { notifications: progressNotifs, newShownKeys } = checkProgressNudges(
    oldStats, newStats, shownNudges, earnedIds
  );

  if (rollIdForAllTheWay && !earnedIds.has("finished_roll")) {
    const roll = rolls.find((r) => r.id === rollIdForAllTheWay);
    if (roll) {
      const remaining = roll.frameCount - roll.shots.length;
      const nudgeKey = `all_the_way:${rollIdForAllTheWay}`;
      if (remaining === 5 && !shownNudges.includes(nudgeKey)) {
        progressNotifs.push({
          id: uid(), type: "badge_progress", emoji: "✅",
          title: "Getting closer",
          message: "5 frames to go on this roll — fill it and earn All the Way ✅",
        });
        newShownKeys.push(nudgeKey);
      }
    }
  }

  return { notifications: [...badgeNotifs, ...progressNotifs], newShownKeys };
}
