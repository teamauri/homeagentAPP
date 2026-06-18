import { Observation } from "@/lib/family/profile";
import { ageAt, seedFamilyMembers } from "@/lib/family/profile";
import { listDemoMedia, listDemoMemory } from "@/lib/demo/demo-store";
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
  const child = seedFamilyMembers.find((m) => m.id === "mia");
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
      thumbDataUrl: m.thumbnailUrl || m.url,
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

  return {
    child: seed.child,
    session: g.__auriGrowthSession ?? seed.session,
    days: sortByDateDesc([...dayMap.values()]),
    firsts: sortByDateDesc([...(g.__auriGrowthFirsts ?? []), ...seed.firsts]),
    skippedCount: g.__auriGrowthSkipped ?? 0,
  };
}

export function listGrowthObservations() {
  return [...(g.__auriGrowthObs ?? [])];
}
