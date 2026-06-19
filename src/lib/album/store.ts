import { Observation } from "@/lib/family/profile";
import { ageAt } from "@/lib/family/profile";
import { getMember } from "@/lib/family/store";
import { listDemoMedia, listDemoMemory } from "@/lib/demo/demo-store";
import { persistStore, registerStore } from "@/lib/demo/persistence";
import { seedGrowthData } from "./seed";
import { DayGroup, FirstItem, GrowthData, MilestoneSession, OrganizedMedia } from "./types";
import { OrganizeResult } from "./organize";

// In-memory store for the growth view. The MEDIA itself lives in the shared
// demo-store (robot Stories ingested via DockKit + phone uploads); this layer
// holds the AI structure (firsts, captions, support session) and merges in
// those demo-store Stories so everything shows in one Memory timeline.
const g = globalThis as typeof globalThis & {
  __auriGrowthDays?: DayGroup[];
  __auriGrowthFirsts?: FirstItem[];
  __auriGrowthSession?: MilestoneSession;
  __auriGrowthSkipped?: number;
  __auriGrowthObs?: Observation[];
};

registerStore({
  key: "growth",
  snapshot: () => ({
    days: g.__auriGrowthDays,
    firsts: g.__auriGrowthFirsts,
    session: g.__auriGrowthSession,
    skipped: g.__auriGrowthSkipped,
    obs: g.__auriGrowthObs,
  }),
  restore: (data) => {
    if (Array.isArray(data.days)) g.__auriGrowthDays = data.days as DayGroup[];
    if (Array.isArray(data.firsts)) g.__auriGrowthFirsts = data.firsts as FirstItem[];
    if (data.session) g.__auriGrowthSession = data.session as MilestoneSession;
    if (typeof data.skipped === "number") g.__auriGrowthSkipped = data.skipped;
    if (Array.isArray(data.obs)) g.__auriGrowthObs = data.obs as Observation[];
  },
});

/** Persist the organized-album growth structure after a mutation. */
export function persistGrowthStore() {
  return persistStore("growth");
}

/** Wipe all organized-album content back to the seed (clears organized photos,
 *  firsts, the overridden session, and observations). */
export function resetGrowthStore() {
  g.__auriGrowthDays = [];
  g.__auriGrowthFirsts = [];
  g.__auriGrowthSession = undefined;
  g.__auriGrowthSkipped = 0;
  g.__auriGrowthObs = [];
}

function sortByDateDesc<T extends { dateISO: string }>(items: T[]) {
  return [...items].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function durationLabel(seconds?: number) {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

// Convert real Stories sitting in the shared demo-store (robot ingest / phone
// upload) into growth DayGroups so they render in the same timeline.
function demoStoryDays(): DayGroup[] {
  const child = getMember("mia");
  const media = listDemoMedia();
  const byId = new Map(media.map((m) => [m.id, m]));
  const items = listDemoMemory().filter((it) => it.metadata?.fixture !== true && it.mediaIds.length > 0);

  return items.map((it) => {
    const mediaItems = it.mediaIds.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
    const dateISO = mediaItems[0]?.capturedAt || it.createdAt || new Date().toISOString();
    const organized: OrganizedMedia[] = mediaItems.map((m) => ({
      id: m.id,
      kind: m.mediaType === "photo" ? "photo" : "video",
      source: m.source === "auri" ? "auri" : "phone",
      // Attribute to a child when the ingest tagged a known one (mia/leo).
      childId: m.person === "mia" || m.person === "leo" ? m.person : undefined,
      // Photos use their image; a video only shows a poster if one exists,
      // otherwise the tile falls back to a gradient + ▶ (poster frames are ③).
      thumbDataUrl: m.mediaType === "photo" ? m.thumbnailUrl || m.url : m.thumbnailUrl,
      url: m.url,
      durationLabel: durationLabel(m.durationSeconds),
      capturedAtISO: m.capturedAt,
      isFirst: false,
    }));
    return {
      dateISO,
      dateLabel: it.timeLabel || dateLabel(dateISO),
      ageShort: ageAt(child?.birthday, dateISO)?.short,
      caption: it.body || it.title,
      isFirstDay: false,
      memoryId: it.id,
      media: organized,
    };
  });
}

export function addOrganized(result: OrganizeResult) {
  g.__auriGrowthDays = [...(g.__auriGrowthDays ?? []), ...result.growth.days];
  g.__auriGrowthFirsts = [...(g.__auriGrowthFirsts ?? []), ...result.growth.firsts];
  g.__auriGrowthSession = result.growth.session;
  g.__auriGrowthSkipped = (g.__auriGrowthSkipped ?? 0) + result.skippedCount;
  g.__auriGrowthObs = [...(g.__auriGrowthObs ?? []), ...result.observations];
}

export function getGrowth(): GrowthData {
  const seed = seedGrowthData();

  // Merge: seed album + phone-organized days + real demo-store Stories.
  const dayMap = new Map<string, DayGroup>();
  const add = (day: DayGroup, prepend = false) => {
    const existing = dayMap.get(day.dateISO);
    if (existing) {
      existing.media = prepend ? [...day.media, ...existing.media] : [...existing.media, ...day.media];
      if (day.isFirstDay) {
        existing.isFirstDay = true;
        if (day.caption) existing.caption = day.caption;
      }
    } else {
      dayMap.set(day.dateISO, { ...day, media: [...day.media] });
    }
  };

  seed.days.forEach((d) => add(d));
  demoStoryDays().forEach((d) => add(d, true)); // robot/phone real media first
  (g.__auriGrowthDays ?? []).forEach((d) => add(d, true)); // organized phone photos first

  // Per-child milestone cards: seed for every child, overridden by the freshly
  // organized session for whichever child was last organized.
  const sessions = { ...(seed.sessions ?? {}) };
  if (g.__auriGrowthSession) sessions[g.__auriGrowthSession.childId] = g.__auriGrowthSession;

  return {
    child: seed.child,
    session: g.__auriGrowthSession ?? seed.session,
    sessions,
    days: sortByDateDesc([...dayMap.values()]),
    firsts: sortByDateDesc([...(g.__auriGrowthFirsts ?? []), ...seed.firsts]),
    skippedCount: g.__auriGrowthSkipped ?? 0,
  };
}

export function listGrowthObservations() {
  return [...(g.__auriGrowthObs ?? [])];
}
