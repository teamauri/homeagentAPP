import { Observation } from "@/lib/family/profile";
import { seedGrowthData } from "./seed";
import { DayGroup, FirstItem, GrowthData, MilestoneSession } from "./types";
import { OrganizeResult } from "./organize";

// In-memory store for organized growth data (demo). Merges the seed album with
// anything the parent has organized this session.
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

export function addOrganized(result: OrganizeResult) {
  g.__auriGrowthDays = [...(g.__auriGrowthDays ?? []), ...result.growth.days];
  g.__auriGrowthFirsts = [...(g.__auriGrowthFirsts ?? []), ...result.growth.firsts];
  g.__auriGrowthSession = result.growth.session;
  g.__auriGrowthSkipped = (g.__auriGrowthSkipped ?? 0) + result.skippedCount;
  g.__auriGrowthObs = [...(g.__auriGrowthObs ?? []), ...result.observations];
}

export function getGrowth(): GrowthData {
  const seed = seedGrowthData();

  // Merge organized days into seed days by date (organized media first).
  const dayMap = new Map<string, DayGroup>();
  for (const day of seed.days) dayMap.set(day.dateISO, { ...day, media: [...day.media] });
  for (const day of g.__auriGrowthDays ?? []) {
    const existing = dayMap.get(day.dateISO);
    if (existing) {
      existing.media = [...day.media, ...existing.media];
      if (day.isFirstDay) {
        existing.isFirstDay = true;
        if (day.caption) existing.caption = day.caption;
      }
    } else {
      dayMap.set(day.dateISO, day);
    }
  }

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
